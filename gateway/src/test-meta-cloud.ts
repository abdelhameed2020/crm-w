import crypto from 'crypto';
import http from 'http';
import { createServer } from './server.js';
import { CONFIG } from './config.js';
import { SyncQueueService } from './sync-queue.service.js';

// Setup test environment overrides
CONFIG.META_WEBHOOK_VERIFY_TOKEN = 'test_verify_token_xyz123';
CONFIG.META_APP_SECRET = 'test_app_secret_abc456';
CONFIG.GATEWAY_API_KEY = 'test_gateway_key_789';

async function runTests() {
  console.log('🚀 Starting Meta WhatsApp Cloud API Integration Tests...\n');

  const app = createServer();
  const server = http.createServer(app);

  await new Promise<void>((resolve) => {
    server.listen(5099, '127.0.0.1', () => resolve());
  });

  const baseUrl = 'http://127.0.0.1:5099';
  let passedTests = 0;
  let totalTests = 0;

  function assert(condition: boolean, msg: string) {
    totalTests++;
    if (condition) {
      console.log(`  ✅ [PASS] ${msg}`);
      passedTests++;
    } else {
      console.error(`  ❌ [FAIL] ${msg}`);
      throw new Error(`Assertion failed: ${msg}`);
    }
  }

  try {
    // ---------------------------------------------------------
    // Test 1: GET /api/webhooks/whatsapp - Challenge Verification (Success)
    // ---------------------------------------------------------
    console.log('Test 1: Valid Webhook Verification Challenge');
    const challengeParam = 'meta_random_challenge_string_9988';
    const verifyRes = await fetch(
      `${baseUrl}/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=test_verify_token_xyz123&hub.challenge=${challengeParam}`
    );
    const verifyBody = await verifyRes.text();
    assert(verifyRes.status === 200, 'Expected status 200 on valid challenge');
    assert(verifyBody === challengeParam, 'Expected challenge string returned in body');

    // ---------------------------------------------------------
    // Test 2: GET /api/webhooks/whatsapp - Challenge Verification (Wrong Token)
    // ---------------------------------------------------------
    console.log('\nTest 2: Invalid Webhook Verification Token (Should Reject 403)');
    const rejectRes = await fetch(
      `${baseUrl}/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=wrong_token&hub.challenge=abc`
    );
    assert(rejectRes.status === 403, 'Expected status 403 on invalid verify_token');

    // ---------------------------------------------------------
    // Test 3: POST /api/webhooks/whatsapp - Invalid Signature (Should Reject 401)
    // ---------------------------------------------------------
    console.log('\nTest 3: POST Webhook with Missing or Invalid HMAC Signature');
    const samplePayload = {
      object: 'whatsapp_business_account',
      entry: [
        {
          id: '10987654321',
          changes: [
            {
              field: 'messages',
              value: {
                messaging_product: 'whatsapp',
                metadata: {
                  display_phone_number: '15551234567',
                  phone_number_id: '998877665544',
                },
                contacts: [{ profile: { name: 'عميل حقيقي للأولاد يحيى' }, wa_id: '201011223344' }],
                messages: [
                  {
                    from: '201011223344',
                    id: 'wamid.HBgLMjAxMDExMjIzMzQ0FQIAEhggQ0ZFNTk0REQ2QTBCNDY1N0Ex',
                    timestamp: '1700000000',
                    text: { body: 'السلام عليكم، استفسار عن مواسير ومستلزمات الصرف' },
                    type: 'text',
                  },
                ],
              },
            },
          ],
        },
      ],
    };

    const payloadRaw = JSON.stringify(samplePayload);

    const badSigRes = await fetch(`${baseUrl}/api/webhooks/whatsapp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-hub-signature-256': 'sha256=invalid_hex_digest_0000000000000',
      },
      body: payloadRaw,
    });
    assert(badSigRes.status === 401, 'Expected status 401 when HMAC signature does not match');

    // ---------------------------------------------------------
    // Test 4: POST /api/webhooks/whatsapp - Valid HMAC Signature (Should Accept 200)
    // ---------------------------------------------------------
    console.log('\nTest 4: POST Webhook with Valid HMAC SHA-256 Signature');
    const validHmac =
      'sha256=' +
      crypto
        .createHmac('sha256', CONFIG.META_APP_SECRET)
        .update(Buffer.from(payloadRaw))
        .digest('hex');

    const goodSigRes = await fetch(`${baseUrl}/api/webhooks/whatsapp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-hub-signature-256': validHmac,
      },
      body: payloadRaw,
    });
    const goodSigBody = await goodSigRes.text();
    assert(goodSigRes.status === 200, 'Expected status 200 on valid signature');
    assert(goodSigBody === 'EVENT_RECEIVED', 'Expected EVENT_RECEIVED response');

    // Allow async parsing in server
    await new Promise((r) => setTimeout(r, 200));

    // ---------------------------------------------------------
    // Test 5: Verify Buffered Inbound Message in Sync Queue
    // ---------------------------------------------------------
    console.log('\nTest 5: Verify Message Buffered in SyncQueueService');
    const pendingList = SyncQueueService.getPendingMessages();
    const buffered = pendingList.find(
      (m) => m.externalMessageId === 'wamid.HBgLMjAxMDExMjIzMzQ0FQIAEhggQ0ZFNTk0REQ2QTBCNDY1N0Ex'
    );
    assert(Boolean(buffered), 'Inbound message should be present in pending queue');
    assert(buffered?.senderPhone === '+201011223344', 'Sender phone formatted with leading plus');
    assert(buffered?.senderName === 'عميل حقيقي للأولاد يحيى', 'Sender name correctly extracted from contacts');
    assert(buffered?.content === 'السلام عليكم، استفسار عن مواسير ومستلزمات الصرف', 'Content correctly parsed');
    assert(buffered?.accountId === 'wa_cloud_998877665544', 'Account ID correctly tagged as wa_cloud_<phoneNumberId>');

    // ---------------------------------------------------------
    // Test 6: Idempotency (Duplicate Webhook Delivery)
    // ---------------------------------------------------------
    console.log('\nTest 6: Idempotency on Repeated Webhook Delivery');
    const initialCount = SyncQueueService.getPendingMessages().length;
    await fetch(`${baseUrl}/api/webhooks/whatsapp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-hub-signature-256': validHmac,
      },
      body: payloadRaw,
    });
    await new Promise((r) => setTimeout(r, 100));
    const countAfterRetry = SyncQueueService.getPendingMessages().length;
    assert(countAfterRetry === initialCount, 'Duplicate message should NOT increase queue size');

    // ---------------------------------------------------------
    // Test 7: POST /api/cloud/messages/send - Validation Check
    // ---------------------------------------------------------
    console.log('\nTest 7: Outbound Cloud Send Validation');
    const missingPhoneRes = await fetch(`${baseUrl}/api/cloud/messages/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-gateway-key': 'test_gateway_key_789',
      },
      body: JSON.stringify({ content: 'Test hello' }),
    });
    assert(missingPhoneRes.status === 400, 'Expected 400 when recipientPhone is missing');

    console.log(`\n🎉 All ${passedTests}/${totalTests} Tests PASSED Successfully!\n`);
    process.exit(0);
  } finally {
    // Cleanup pending messages and close server
    SyncQueueService.ackMessages(['wamid.HBgLMjAxMDExMjIzMzQ0FQIAEhggQ0ZFNTk0REQ2QTBCNDY1N0Ex']);
    server.close();
  }
}

runTests().catch((err) => {
  console.error('❌ Test suite failed:', err);
  process.exit(1);
});
