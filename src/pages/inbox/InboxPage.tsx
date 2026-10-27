import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  Send,
  Paperclip,
  UserCheck,
  Tag,
  FileText,
  Phone,
  Mail,
  CheckCheck,
  Check,
  ArrowRight,
  Info,
  MessageSquare,
  Plus,
  X,
  RefreshCw,
  Edit,
  Download,
  Maximize2,
  Loader2,
  Image as ImageIcon,
  Reply,
  Clock,
  AlertTriangle,
  History,
  ShieldCheck,
} from 'lucide-react';
import { ChannelIcon } from '../../components/common/ChannelIcon';
import { Badge } from '../../components/common/Badge';
import { EmptyState } from '../../components/common/EmptyState';
import { Button } from '../../components/common/Button';
import type { Conversation, ConversationStatus } from '../../types/conversation.types';
import type { ChannelType } from '../../types/channel.types';
import type { Message } from '../../types/message.types';
import type { Customer, CustomerNote, LeadStatus } from '../../types/customer.types';
import type { Employee } from '../../types/employee.types';
import { ConversationsService } from '../../services/firebase/conversations.service';
import { MessagesService } from '../../services/firebase/messages.service';
import { CustomersService } from '../../services/firebase/customers.service';
import { EmployeesService } from '../../services/firebase/employees.service';
import { FirestoreService } from '../../services/firebase/firestore.service';
import { COLLECTIONS } from '../../services/firebase/collections';
import { channelManager } from '../../services/channels/ChannelManager';
import { processGatewaySync } from '../../services/channels/gatewaySyncWorker';
import { GatewayApiClient } from '../../services/channels/gatewayApiClient';
import { AutoAssignmentService } from '../../services/assignment/AutoAssignmentService';
import { SlaMonitorService } from '../../services/assignment/SlaMonitorService';
import { useAuth } from '../../hooks/useAuth';

interface StagedAttachment {
  id: string;
  file: File;
  name: string;
  size: number;
  type: 'image' | 'video' | 'audio' | 'document';
  previewUrl: string;
  base64: string;
}

export const InboxPage: React.FC = () => {
  const { user, isManager } = useAuth();

  // State
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [activeCustomer, setActiveCustomer] = useState<Customer | null>(null);
  const [isLoadingConversations, setIsLoadingConversations] = useState(true);
  const [conversationsError, setConversationsError] = useState<string | null>(null);

  // Filters
  const [assignmentScope, setAssignmentScope] = useState<'my' | 'unassigned' | 'all'>(
    user?.role === 'employee' ? 'my' : 'all'
  );
  const [selectedChannel, setSelectedChannel] = useState<ChannelType | 'all'>('all');
  const [selectedStatus, setSelectedStatus] = useState<ConversationStatus | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [messageInput, setMessageInput] = useState('');
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);

  // Helper to resolve employee name cleanly
  const getEmployeeSenderName = (msg: Message) => {
    if (msg.senderName && msg.senderName !== 'الموظف' && msg.senderName !== 'موظف') {
      return msg.senderName;
    }
    if (msg.senderId === user?.id && user?.displayName) {
      return user.displayName;
    }
    const emp = employees.find((e) => e.id === msg.senderId);
    if (emp?.name) return emp.name;
    return msg.senderName || 'موظف';
  };

  // Media attachments staging state (Multi-media sending like WhatsApp)
  const [stagedFiles, setStagedFiles] = useState<StagedAttachment[]>([]);
  const [isUploadingMedia, setIsUploadingMedia] = useState(false);
  const [activeLightboxUrl, setActiveLightboxUrl] = useState<string | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Mobile View state
  const [mobileTab, setMobileTab] = useState<'list' | 'chat' | 'info'>('list');

  // New Conversation Modal State
  const [isNewConvModalOpen, setIsNewConvModalOpen] = useState(false);
  const [newConvName, setNewConvName] = useState('');
  const [newConvPhone, setNewConvPhone] = useState('');
  const [newConvChannel, setNewConvChannel] = useState<ChannelType>('whatsapp');
  const [newConvMessage, setNewConvMessage] = useState('');
  const [isStartingConv, setIsStartingConv] = useState(false);
  const [newConvError, setNewConvError] = useState<string | null>(null);

  // Employees list for assignment
  const [employees, setEmployees] = useState<Employee[]>([]);

  // Customer Notes state
  const [customerNotes, setCustomerNotes] = useState<CustomerNote[]>([]);
  const [newNoteText, setNewNoteText] = useState('');
  const [isAddingNote, setIsAddingNote] = useState(false);

  // Edit Customer Modal State
  const [isEditCustomerOpen, setIsEditCustomerOpen] = useState(false);
  const [editCustomerName, setEditCustomerName] = useState('');
  const [editCustomerPhone, setEditCustomerPhone] = useState('');
  const [editCustomerEmail, setEditCustomerEmail] = useState('');
  const [editCustomerLeadStatus, setEditCustomerLeadStatus] = useState<LeadStatus>('new');
  const [isSavingCustomer, setIsSavingCustomer] = useState(false);

  // Background sync worker for inbound WhatsApp gateway messages
  useEffect(() => {
    processGatewaySync();
    const timer = setInterval(() => {
      processGatewaySync();
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  // Background First Response SLA Monitoring & Queue processing (Every 15s)
  useEffect(() => {
    const runSlaChecks = async () => {
      try {
        await SlaMonitorService.checkAndEscalateBreachedConversations();
        await AutoAssignmentService.processWaitingQueue();
      } catch (err) {
        console.warn('SLA/Queue monitor check failed:', err);
      }
    };

    runSlaChecks();
    const slaTimer = setInterval(runSlaChecks, 15000);
    return () => clearInterval(slaTimer);
  }, []);

  // Real-time employees subscription
  useEffect(() => {
    const unsub = EmployeesService.subscribeToEmployees(
      (data) => setEmployees(data),
      (err) => console.error('Employees error:', err)
    );
    return () => unsub();
  }, []);

  // Real-time conversations subscription
  useEffect(() => {
    setIsLoadingConversations(true);
    setConversationsError(null);

    const filter = {
      ...(selectedChannel !== 'all' ? { channel: selectedChannel } : {}),
      ...(selectedStatus !== 'all' ? { status: selectedStatus } : {}),
      ...(assignmentScope === 'my' && user ? { assignedEmployeeId: user.id } : {}),
      ...(assignmentScope === 'unassigned' ? { unassignedOnly: true } : {}),
    };

    const unsubscribe = ConversationsService.subscribeToConversations(
      filter,
      (data) => {
        setConversations(data);
        setIsLoadingConversations(false);
      },
      (err) => {
        console.error('Conversations error:', err);
        setConversationsError(`تعذر تحميل المحادثات: ${err?.message || 'يرجى التحقق من الاتصال والصلاحيات'}`);
        setIsLoadingConversations(false);
      }
    );

    return () => unsubscribe();
  }, [selectedChannel, selectedStatus, assignmentScope, user]);

  // Real-time messages & customer details when conversation selected
  useEffect(() => {
    let isCurrent = true;
    if (!selectedConversation) {
      setMessages([]);
      setActiveCustomer(null);
      return;
    }

    const unsubscribeMessages = MessagesService.subscribeToMessages(
      selectedConversation.id,
      (data) => {
        if (isCurrent) setMessages(data);
      },
      (err) => console.error('Messages error:', err)
    );

    CustomersService.getCustomer(selectedConversation.customerId)
      .then((cust) => {
        if (isCurrent) setActiveCustomer(cust);
      })
      .catch((err) => {
        console.error('Customer fetch error:', err);
      });

    return () => {
      isCurrent = false;
      unsubscribeMessages();
    };
  }, [selectedConversation]);

  // Real-time customer notes subscription
  useEffect(() => {
    if (!selectedConversation?.customerId) {
      setCustomerNotes([]);
      return;
    }
    const unsub = CustomersService.subscribeToNotes(
      selectedConversation.customerId,
      (notes) => setCustomerNotes(notes)
    );
    return () => unsub();
  }, [selectedConversation?.customerId]);

  // File Selection & Drag-Drop Handlers (WhatsApp-style multi-media)
  const handleFilesSelected = (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    if (fileArray.length === 0) return;

    fileArray.forEach((file) => {
      let type: 'image' | 'video' | 'audio' | 'document' = 'document';
      if (file.type.startsWith('image/')) type = 'image';
      else if (file.type.startsWith('video/')) type = 'video';
      else if (file.type.startsWith('audio/')) type = 'audio';

      const reader = new FileReader();
      reader.onload = (e) => {
        const base64 = e.target?.result as string;
        const previewUrl = type === 'image' ? URL.createObjectURL(file) : '';
        setStagedFiles((prev) => [
          ...prev,
          {
            id: `file_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            file,
            name: file.name,
            size: file.size,
            type,
            previewUrl,
            base64,
          },
        ]);
      };
      reader.readAsDataURL(file);
    });
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    if (e.clipboardData.files && e.clipboardData.files.length > 0) {
      e.preventDefault();
      handleFilesSelected(e.clipboardData.files);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFilesSelected(e.dataTransfer.files);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(true);
  };

  const handleDragLeave = () => {
    setIsDraggingOver(false);
  };

  // Outbound message send (Supports pure text and multiple media files)
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!messageInput.trim() && stagedFiles.length === 0) || !selectedConversation) return;

    const currentInput = messageInput.trim();
    const currentStaged = [...stagedFiles];
    const currentReplyingTo = replyingTo;
    setMessageInput('');
    setStagedFiles([]);
    setReplyingTo(null);

    const quotedMeta = currentReplyingTo
      ? {
          quoted: {
            id: currentReplyingTo.id,
            sender:
              currentReplyingTo.senderName ||
              (currentReplyingTo.senderType === 'employee'
                ? getEmployeeSenderName(currentReplyingTo)
                : 'العميل'),
            text:
              currentReplyingTo.content ||
              (currentReplyingTo.messageType === 'image' ? '[صورة]' : '[ملف]'),
          },
        }
      : undefined;

    let recipientPhone = selectedConversation.customerPhone || activeCustomer?.phone || '';
    if (recipientPhone.replace(/[^\d]/g, '').length > 13) {
      const resolved = await GatewayApiClient.resolvePhone(recipientPhone);
      if (resolved && resolved !== recipientPhone) {
        recipientPhone = resolved;
      }
    }
    const accountId = selectedConversation.channelAccountId || 'default';

    // 1. If user selected media files (Send each photo/media like WhatsApp)
    if (currentStaged.length > 0) {
      setIsUploadingMedia(true);
      for (let i = 0; i < currentStaged.length; i++) {
        const item = currentStaged[i];
        const caption = i === 0 ? currentInput : '';
        const msgId = `msg_${Date.now()}_${i}`;

        const newMessage: Message = {
          id: msgId,
          conversationId: selectedConversation.id,
          customerId: selectedConversation.customerId,
          channel: selectedConversation.channel,
          senderType: 'employee',
          senderId: user?.id || 'emp_1',
          senderName: user?.displayName || 'الموظف',
          content: caption || (item.type === 'image' ? '[صورة]' : `[ملف ${item.name}]`),
          messageType: item.type,
          mediaUrl: item.previewUrl || undefined,
          media: [
            {
              url: item.previewUrl || '',
              type: item.type,
              fileName: item.name,
              fileSize: item.size,
              mimeType: item.file.type,
            },
          ],
          replyToMessageId: currentReplyingTo?.id,
          ...(quotedMeta ? { metadata: quotedMeta } : {}),
          status: 'sending',
          timestamp: Date.now() + i,
        };

        try {
          await MessagesService.createMessage(newMessage);

          if (selectedConversation.channel === 'whatsapp') {
            const delivery = await channelManager.sendMessage(
              {
                id: accountId,
                type: 'whatsapp',
                name: 'WhatsApp Account',
                identifier: recipientPhone,
                status: 'connected',
                isActive: true,
                createdAt: Date.now(),
                updatedAt: Date.now(),
              },
              {
                recipientId: recipientPhone,
                content: caption,
                mediaType: item.type,
                mediaBase64: item.base64,
                fileName: item.name,
                mimeType: item.file.type,
              }
            );

            if (delivery.success) {
              await MessagesService.updateMessageStatus(msgId, 'sent', delivery.externalMessageId);
              if (delivery.mediaUrl) {
                await FirestoreService.update<Message>(COLLECTIONS.MESSAGES, msgId, {
                  mediaUrl: delivery.mediaUrl,
                  media: [
                    {
                      url: delivery.mediaUrl,
                      type: item.type,
                      fileName: item.name,
                      fileSize: item.size,
                      mimeType: item.file.type,
                    },
                  ],
                });
              }
            } else {
              console.warn('Failed delivering media message:', delivery.error);
              await MessagesService.updateMessageStatus(msgId, 'failed');
            }
          } else {
            setTimeout(() => {
              MessagesService.updateMessageStatus(msgId, 'sent');
            }, 500);
          }
        } catch (sendErr) {
          console.error('Error sending media message:', sendErr);
          await MessagesService.updateMessageStatus(msgId, 'failed');
        }
      }
      if (user?.id) {
        try {
          await AutoAssignmentService.recordAgentFirstResponse(selectedConversation.id, user.id);
        } catch (slaErr) {
          console.warn('Failed recording first response SLA:', slaErr);
        }
      }
      setIsUploadingMedia(false);
      return;
    }

    // 2. Pure text message send
    const newMessage: Message = {
      id: `msg_${Date.now()}`,
      conversationId: selectedConversation.id,
      customerId: selectedConversation.customerId,
      channel: selectedConversation.channel,
      senderType: 'employee',
      senderId: user?.id || 'emp_1',
      senderName: user?.displayName || 'الموظف',
      content: currentInput,
      messageType: 'text',
      replyToMessageId: currentReplyingTo?.id,
      ...(quotedMeta ? { metadata: quotedMeta } : {}),
      status: 'sending',
      timestamp: Date.now(),
    };

    try {
      await MessagesService.createMessage(newMessage);

      if (selectedConversation.channel === 'whatsapp') {
        try {
          const delivery = await channelManager.sendMessage(
            {
              id: accountId,
              type: 'whatsapp',
              name: 'WhatsApp Account',
              identifier: recipientPhone,
              status: 'connected',
              isActive: true,
              createdAt: Date.now(),
              updatedAt: Date.now(),
            },
            {
              recipientId: recipientPhone,
              content: currentInput,
            }
          );

          if (delivery.success) {
            await MessagesService.updateMessageStatus(newMessage.id, 'sent', delivery.externalMessageId);
          } else {
            console.warn('WhatsApp Gateway delivery failed:', delivery.error);
            await MessagesService.updateMessageStatus(newMessage.id, 'failed');
          }
        } catch (gwErr) {
          console.error('Failed to dispatch via WhatsApp gateway:', gwErr);
          await MessagesService.updateMessageStatus(newMessage.id, 'failed');
        }
      } else {
        setTimeout(() => {
          MessagesService.updateMessageStatus(newMessage.id, 'sent');
        }, 500);
      }

      if (user?.id) {
        try {
          await AutoAssignmentService.recordAgentFirstResponse(selectedConversation.id, user.id);
        } catch (slaErr) {
          console.warn('Failed recording first response SLA:', slaErr);
        }
      }
    } catch (err) {
      console.error('Failed to send text message:', err);
    }
  };

  const handleStartNewConversation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newConvName.trim() || !newConvPhone.trim()) {
      setNewConvError('يرجى كتابة اسم العميل ورقم الهاتف');
      return;
    }
    setIsStartingConv(true);
    setNewConvError(null);

    try {
      const cleanPhone = '+' + newConvPhone.replace(/[^\d]/g, '');
      const custId = `cust_${cleanPhone.replace('+', '')}`;

      // 1. Create or ensure customer exists
      const newCustomer: Customer = {
        id: custId,
        name: newConvName.trim(),
        phone: cleanPhone,
        leadStatus: 'new',
        tags: [newConvChannel],
        sourceChannel: newConvChannel,
        notesCount: 0,
        dealsCount: 0,
        dealsTotalValue: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        lastContactedAt: Date.now(),
      };
      await CustomersService.saveCustomer(newCustomer);

      // 2. Check if open conversation already exists for this contact
      const rawDigits = cleanPhone.replace(/[^\d]/g, '');
      const existingConv = conversations.find(
        (c) =>
          c.channel === newConvChannel &&
          c.status !== 'closed' &&
          (c.customerPhone === cleanPhone ||
            (c.customerPhone && c.customerPhone.replace(/[^\d]/g, '').slice(-9) === rawDigits.slice(-9)))
      );

      let targetConv: Conversation;
      let convId: string;

      if (existingConv) {
        targetConv = existingConv;
        convId = existingConv.id;
        if (newConvMessage.trim()) {
          await ConversationsService.updateConversation(convId, {
            lastMessageSnippet: newConvMessage.trim(),
            lastMessageTimestamp: Date.now(),
            lastMessageSenderType: 'employee',
            updatedAt: Date.now(),
          });
        }
      } else {
        convId = `conv_${Date.now()}`;
        const snippet = newConvMessage.trim() || 'بدء المحادثة';
        const newConv: Conversation = {
          id: convId,
          customerId: custId,
          customerName: newConvName.trim(),
          customerPhone: cleanPhone,
          channel: newConvChannel,
          channelAccountId: 'default',
          status: 'open',
          priority: 'normal',
          assignedEmployeeId: user?.id,
          assignedEmployeeName: user?.displayName,
          unreadCount: 0,
          lastMessageSnippet: snippet,
          lastMessageTimestamp: Date.now(),
          lastMessageSenderType: 'employee',
          tags: [newConvChannel],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        await ConversationsService.createConversation(newConv);
        targetConv = newConv;
      }

      // 3. Create message if text provided
      if (newConvMessage.trim()) {
        const msgId = `msg_${Date.now()}`;
        const initialMsg: Message = {
          id: msgId,
          conversationId: convId,
          customerId: targetConv.customerId || custId,
          channel: newConvChannel,
          senderType: 'employee',
          senderId: user?.id || 'emp_1',
          senderName: user?.displayName || 'الموظف',
          content: newConvMessage.trim(),
          messageType: 'text',
          status: 'sending',
          timestamp: Date.now(),
        };
        await MessagesService.createMessage(initialMsg);

        // 4. If channel is WhatsApp, dispatch via Gateway
        if (newConvChannel === 'whatsapp') {
          try {
            const delivery = await channelManager.sendMessage(
              {
                id: 'default',
                type: 'whatsapp',
                name: 'WhatsApp Account',
                identifier: cleanPhone,
                status: 'connected',
                isActive: true,
                createdAt: Date.now(),
                updatedAt: Date.now(),
              },
              {
                recipientId: cleanPhone,
                content: newConvMessage.trim(),
              }
            );
            if (delivery.success) {
              await MessagesService.updateMessageStatus(msgId, 'sent', delivery.externalMessageId);
            } else {
              await MessagesService.updateMessageStatus(msgId, 'failed');
            }
          } catch {
            await MessagesService.updateMessageStatus(msgId, 'failed');
          }
        }
      }

      // Select conversation
      setSelectedConversation(targetConv);
      setIsNewConvModalOpen(false);
      setNewConvName('');
      setNewConvPhone('');
      setNewConvMessage('');
    } catch (err: any) {
      console.error('Failed starting conversation:', err);
      setNewConvError(err?.message || 'فشل بدء المحادثة');
    } finally {
      setIsStartingConv(false);
    }
  };

  // Assignment handler (works for both Admin/Manager and Employees)
  const handleAssignConversation = async (empId: string) => {
    if (!selectedConversation || !user) return;
    const targetEmp = employees.find((e) => e.id === empId);
    const empName = targetEmp ? targetEmp.name : undefined;

    try {
      await ConversationsService.assignEmployee(
        selectedConversation.id,
        empId || undefined,
        empName,
        user.id,
        user.displayName || 'المستخدم'
      );
      // Immediately reflect in state
      setSelectedConversation((prev) =>
        prev
          ? {
              ...prev,
              assignedEmployeeId: empId || undefined,
              assignedEmployeeName: empName,
            }
          : null
      );
      setConversations((prev) =>
        prev.map((c) =>
          c.id === selectedConversation.id
            ? { ...c, assignedEmployeeId: empId || undefined, assignedEmployeeName: empName }
            : c
        )
      );
    } catch (err: any) {
      console.error('Failed to assign conversation:', err);
      alert('فشل تعيين المحادثة: ' + (err?.message || 'خطأ غير معروف'));
    }
  };

  // Open Edit Customer Modal
  const openEditCustomerModal = () => {
    if (!selectedConversation) return;
    setEditCustomerName(activeCustomer?.name || selectedConversation.customerName || '');
    setEditCustomerPhone(activeCustomer?.phone || selectedConversation.customerPhone || '');
    setEditCustomerEmail(activeCustomer?.email || '');
    setEditCustomerLeadStatus(activeCustomer?.leadStatus || 'new');
    setIsEditCustomerOpen(true);
  };

  // Save Customer Changes
  const handleSaveCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedConversation) return;
    setIsSavingCustomer(true);

    try {
      const cleanPhone = editCustomerPhone.trim();
      const cleanEmail = editCustomerEmail.trim();
      const newName = editCustomerName.trim() || 'عميل بدون اسم';
      const custId = selectedConversation.customerId;

      // 1. Update Customer doc
      const updatedCustomer: Customer = {
        id: custId,
        name: newName,
        phone: cleanPhone,
        ...(cleanEmail ? { email: cleanEmail } : {}),
        leadStatus: editCustomerLeadStatus,
        tags: activeCustomer?.tags || ['whatsapp'],
        sourceChannel: selectedConversation.channel,
        notesCount: activeCustomer?.notesCount || 0,
        dealsCount: activeCustomer?.dealsCount || 0,
        dealsTotalValue: activeCustomer?.dealsTotalValue || 0,
        createdAt: activeCustomer?.createdAt || Date.now(),
        updatedAt: Date.now(),
        lastContactedAt: Date.now(),
      };
      await CustomersService.saveCustomer(updatedCustomer);
      setActiveCustomer(updatedCustomer);

      // 2. Update Conversation doc
      await FirestoreService.update<Conversation>(COLLECTIONS.CONVERSATIONS, selectedConversation.id, {
        customerName: newName,
        customerPhone: cleanPhone,
        updatedAt: Date.now(),
      });

      // 3. Update local state
      setSelectedConversation((prev) =>
        prev
          ? {
              ...prev,
              customerName: newName,
              customerPhone: cleanPhone,
            }
          : null
      );
      setConversations((prev) =>
        prev.map((c) =>
          c.id === selectedConversation.id
            ? { ...c, customerName: newName, customerPhone: cleanPhone }
            : c
        )
      );

      setIsEditCustomerOpen(false);
    } catch (err: any) {
      console.error('Failed saving customer:', err);
      alert('فشل حفظ بيانات العميل: ' + (err?.message || 'يرجى التحقق من الاتصال والصلاحيات'));
    } finally {
      setIsSavingCustomer(false);
    }
  };

  // Add Internal Note
  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNoteText.trim() || !selectedConversation || !user) return;
    setIsAddingNote(true);

    try {
      const note: CustomerNote = {
        id: `note_${Date.now()}`,
        customerId: selectedConversation.customerId,
        authorId: user.id,
        authorName: user.displayName || 'الموظف',
        content: newNoteText.trim(),
        createdAt: Date.now(),
      };
      await CustomersService.addNote(note);
      setNewNoteText('');
    } catch (err: any) {
      console.error('Failed adding note:', err);
      alert('فشل إضافة الملاحظة: ' + (err?.message || 'خطأ'));
    } finally {
      setIsAddingNote(false);
    }
  };

  const filteredConversations = conversations.filter((c) =>
    c.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.lastMessageSnippet?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="h-[calc(100vh-7rem)] flex flex-col bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
      {/* Inbox Channels & Assignment Filter Header */}
      <div className="p-3 border-b border-slate-200 bg-slate-50/70 flex flex-wrap items-center justify-between gap-2 text-xs">
        {/* Assignment Scope Tabs */}
        <div className="flex items-center gap-1 bg-slate-200/60 p-1 rounded-xl">
          <button
            onClick={() => setAssignmentScope('my')}
            className={`px-3 py-1 rounded-lg font-medium transition-colors ${
              assignmentScope === 'my' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            محادثاتي
          </button>
          <button
            onClick={() => setAssignmentScope('unassigned')}
            className={`px-3 py-1 rounded-lg font-medium transition-colors ${
              assignmentScope === 'unassigned' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            غير معينة
          </button>
          {isManager && (
            <button
              onClick={() => setAssignmentScope('all')}
              className={`px-3 py-1 rounded-lg font-medium transition-colors ${
                assignmentScope === 'all' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              جميع المحادثات
            </button>
          )}
        </div>

        {/* Channel Filters */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
          <span className="font-bold text-slate-600 ml-1">القناة:</span>
          {(['all', 'whatsapp', 'messenger', 'instagram', 'website'] as const).map((ch) => (
            <button
              key={ch}
              onClick={() => setSelectedChannel(ch)}
              className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                selectedChannel === ch
                  ? 'bg-brand-600 text-white shadow-sm'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              {ch === 'all' ? 'الكل' : <ChannelIcon channel={ch} showLabel />}
            </button>
          ))}
        </div>

        {/* Status Dropdown & Actions */}
        <div className="flex items-center gap-2">
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value as ConversationStatus | 'all')}
            className="text-xs bg-white border border-slate-200 rounded-lg px-2.5 py-1 focus:outline-none focus:border-brand-500 font-medium text-slate-700"
          >
            <option value="all">جميع الحالات</option>
            <option value="open">مفتوحة</option>
            <option value="pending">معلقة</option>
            <option value="resolved">مغلقة</option>
          </select>

          <button
            onClick={() => {
              setIsLoadingConversations(true);
              processGatewaySync();
            }}
            title="مزامنة وتحديث فوري"
            className="p-1.5 text-slate-500 hover:text-slate-800 bg-white border border-slate-200 rounded-lg transition-colors cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => setIsNewConvModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1 bg-brand-600 hover:bg-brand-700 text-white rounded-lg font-medium text-xs shadow-sm transition-all cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>محادثة جديدة</span>
          </button>
        </div>
      </div>

      {conversationsError && (
        <div className="bg-red-50 border-b border-red-200 px-4 py-2 text-red-700 text-xs flex items-center justify-between">
          <span>{conversationsError}</span>
          <button
            onClick={() => setAssignmentScope(assignmentScope)}
            className="underline font-bold text-red-800 hover:text-red-950"
          >
            إعادة المحاولة
          </button>
        </div>
      )}

      {/* Main 3-Column Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* COLUMN 1: Conversations List */}
        <div
          className={`w-full md:w-80 lg:w-96 border-l border-slate-200 flex flex-col shrink-0 bg-white ${
            mobileTab !== 'list' ? 'hidden md:flex' : 'flex'
          }`}
        >
          {/* Search box */}
          <div className="p-3 border-b border-slate-100">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="بحث في المحادثات..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pr-9 pl-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-brand-500"
              />
            </div>
          </div>

          {/* Conversations Items */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
            {isLoadingConversations ? (
              <div className="p-8 text-center text-xs text-slate-400">
                <div className="w-5 h-5 border-2 border-brand-500/30 border-t-brand-500 rounded-full animate-spin mx-auto mb-2" />
                <span>جاري تحميل المحادثات...</span>
              </div>
            ) : filteredConversations.length === 0 ? (
              <div className="p-6">
                <EmptyState
                  title="لا توجد محادثات نشطة"
                  description="صندوق المحادثات الموحد يستمع إلى قنوات WhatsApp وMessenger والموقع. يمكنك أيضاً بدء محادثة جديدة مع أي عميل الآن."
                  actionLabel="بدء محادثة جديدة"
                  onAction={() => setIsNewConvModalOpen(true)}
                />
              </div>
            ) : (
              filteredConversations.map((conv) => (
                <div
                  key={conv.id}
                  onClick={() => {
                    setSelectedConversation(conv);
                    setMobileTab('chat');
                  }}
                  className={`p-3.5 cursor-pointer transition-colors flex items-start gap-3 hover:bg-slate-50 ${
                    selectedConversation?.id === conv.id ? 'bg-brand-50/70 border-r-4 border-brand-600' : ''
                  }`}
                >
                  <div className="relative shrink-0">
                    <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center font-bold text-slate-600 text-sm">
                      {conv.customerName.charAt(0)}
                    </div>
                    <div className="absolute -bottom-1 -left-1">
                      <ChannelIcon channel={conv.channel} className="w-3.5 h-3.5" />
                    </div>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <h4 className="font-bold text-xs text-slate-800 truncate">{conv.customerName}</h4>
                      <span className="text-[10px] text-slate-400">
                        {new Date(conv.lastMessageTimestamp).toLocaleTimeString('ar-SA', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 truncate mb-1">
                      {conv.lastMessageSnippet || 'بدأت محادثة جديدة'}
                    </p>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Badge size="sm" variant={conv.status === 'open' ? 'success' : 'neutral'}>
                        {conv.status === 'open' ? 'مفتوحة' : conv.status}
                      </Badge>

                      {conv.assignedEmployeeName ? (
                        <span className="text-[10px] text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded font-medium flex items-center gap-1">
                          <UserCheck className="w-2.5 h-2.5 text-slate-500" />
                          {conv.assignedEmployeeName}
                        </span>
                      ) : (
                        <span className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded font-bold flex items-center gap-1 animate-pulse">
                          <Clock className="w-2.5 h-2.5 text-amber-600" />
                          طابور الانتظار
                        </span>
                      )}

                      {conv.isSubstitute && (
                        <span className="text-[10px] text-purple-700 bg-purple-50 font-bold px-1.5 py-0.5 rounded" title={`بديل عن ${conv.primaryOwnerName || 'المسؤول الأصلي'}`}>
                          بديل
                        </span>
                      )}

                      {conv.status === 'open' && (
                        conv.isFirstResponseDone ? (
                          <span className="text-[10px] text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded flex items-center gap-0.5 font-medium" title="تم أول رد على العميل">
                            <ShieldCheck className="w-2.5 h-2.5 text-emerald-600" />
                            تم الرد
                          </span>
                        ) : conv.firstResponseDueAt ? (
                          conv.firstResponseDueAt <= Date.now() ? (
                            <span className="text-[10px] text-red-700 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded flex items-center gap-0.5 font-bold animate-pulse" title="تجاوزت مهلة أول رد SLA">
                              <AlertTriangle className="w-2.5 h-2.5 text-red-600" />
                              تأخر الرد
                            </span>
                          ) : (
                            <span className="text-[10px] text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded flex items-center gap-0.5 font-medium" title="مهلة الرد الأول المتبقية">
                              <Clock className="w-2.5 h-2.5 text-blue-500" />
                              {Math.max(1, Math.ceil((conv.firstResponseDueAt - Date.now()) / 60000))}د
                            </span>
                          )
                        ) : null
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* COLUMN 2: Active Chat Messages Stream */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`flex-1 flex flex-col bg-slate-50/50 overflow-hidden relative ${
            mobileTab !== 'chat' ? 'hidden md:flex' : 'flex'
          }`}
        >
          {/* Drag & Drop Visual Overlay */}
          {isDraggingOver && (
            <div className="absolute inset-0 bg-brand-600/15 backdrop-blur-[2px] border-2 border-dashed border-brand-500 z-30 flex flex-col items-center justify-center pointer-events-none">
              <ImageIcon className="w-12 h-12 text-brand-600 mb-2 animate-bounce" />
              <p className="font-bold text-brand-900 text-sm">أفلت الصور أو الملفات هنا لإرسالها للعميل</p>
            </div>
          )}

          {selectedConversation ? (
            <>
              {/* Chat Top Header */}
              <div className="p-3.5 bg-white border-b border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setMobileTab('list')}
                    className="md:hidden p-1.5 text-slate-500 hover:text-slate-800"
                    title="الرجوع للقائمة"
                  >
                    <ArrowRight className="w-5 h-5" />
                  </button>

                  <div className="w-9 h-9 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center font-bold text-sm">
                    {selectedConversation.customerName.charAt(0)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-sm text-slate-900">
                        {selectedConversation.customerName}
                      </h3>
                      <ChannelIcon channel={selectedConversation.channel} showLabel />
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-slate-500">
                      <span>معين إلى:</span>
                      {isManager ? (
                        <select
                          value={selectedConversation.assignedEmployeeId || ''}
                          onChange={(e) => handleAssignConversation(e.target.value)}
                          className="text-[11px] font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded px-1.5 py-0.5 focus:outline-none cursor-pointer"
                        >
                          <option value="">غير معين (متاحة للجميع)</option>
                          {employees.map((emp) => (
                            <option key={emp.id} value={emp.id}>
                              {emp.name} {emp.id === user?.id ? '(أنت)' : ''}
                            </option>
                          ))}
                        </select>
                      ) : selectedConversation.assignedEmployeeId === user?.id ? (
                        <span className="inline-flex items-center gap-1 font-bold text-green-700 bg-green-50 px-2 py-0.5 rounded text-[10px]">
                          <CheckCheck className="w-3 h-3 text-green-600" />
                          معينة لك (أنت المسؤول)
                        </span>
                      ) : selectedConversation.assignedEmployeeId ? (
                        <span className="font-bold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded">
                          {selectedConversation.assignedEmployeeName}
                        </span>
                      ) : (
                        <button
                          onClick={() => handleAssignConversation(user?.id || '')}
                          className="font-bold text-brand-600 hover:text-brand-800 bg-brand-50 hover:bg-brand-100 px-2 py-0.5 rounded text-[10px] flex items-center gap-1 transition-colors cursor-pointer"
                        >
                          <UserCheck className="w-3 h-3" />
                          <span>استلام المحادثة (تعيين لي)</span>
                        </button>
                      )}

                      {selectedConversation.isSubstitute && (
                        <span className="text-[10px] bg-purple-100 text-purple-800 font-bold px-2 py-0.5 rounded-full">
                          بديل عن ({selectedConversation.primaryOwnerName || 'المسؤول الأصلي'})
                        </span>
                      )}

                      {selectedConversation.status === 'open' && (
                        selectedConversation.isFirstResponseDone ? (
                          <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                            <ShieldCheck className="w-3 h-3 text-emerald-600" />
                            تم أول رد
                          </span>
                        ) : selectedConversation.firstResponseDueAt ? (
                          selectedConversation.firstResponseDueAt <= Date.now() ? (
                            <span className="text-[10px] bg-red-100 text-red-800 font-bold px-2 py-0.5 rounded-full flex items-center gap-1 animate-pulse">
                              <AlertTriangle className="w-3 h-3 text-red-600" />
                              تجاوزت مهلة أول رد (SLA)
                            </span>
                          ) : (
                            <span className="text-[10px] bg-blue-100 text-blue-800 font-medium px-2 py-0.5 rounded-full flex items-center gap-1">
                              <Clock className="w-3 h-3 text-blue-600" />
                              مهلة الرد الأول: {Math.max(1, Math.ceil((selectedConversation.firstResponseDueAt - Date.now()) / 60000))} د
                            </span>
                          )
                        ) : null
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setMobileTab('info')}
                    className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg lg:hidden"
                    title="معلومات العميل"
                  >
                    <Info className="w-4 h-4" />
                  </button>
                  <Button variant="outline" size="sm">
                    إغلاق المحادثة
                  </Button>
                </div>
              </div>

              {/* Chat Messages Stream */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.length === 0 ? (
                  <div className="h-full flex items-center justify-center">
                    <p className="text-xs text-slate-400 bg-white px-4 py-2 rounded-xl border border-slate-200 shadow-sm">
                      لا توجد رسائل سابقة في هذه المحادثة
                    </p>
                  </div>
                ) : (
                  messages.map((msg) => {
                    const isOutgoing = msg.senderType === 'employee';
                    const mediaItem = msg.media?.[0];
                    const mediaUrl = msg.mediaUrl || mediaItem?.url;
                    const isImage = msg.messageType === 'image' || mediaItem?.type === 'image' || (mediaUrl && mediaUrl.match(/\.(jpeg|jpg|png|webp|gif)/i));
                    const isDocument = msg.messageType === 'document' || mediaItem?.type === 'document';
                    const isAudio = msg.messageType === 'audio' || mediaItem?.type === 'audio';
                    const isVideo = msg.messageType === 'video' || mediaItem?.type === 'video';

                    return (
                      <div
                        key={msg.id}
                        className={`flex flex-col group ${isOutgoing ? 'items-end' : 'items-start'}`}
                      >
                        <div className={`flex items-center gap-1.5 max-w-[85%] ${isOutgoing ? 'flex-row' : 'flex-row-reverse'}`}>
                          {/* Quick Reply Button on Hover */}
                          <button
                            type="button"
                            onClick={() => {
                              setReplyingTo(msg);
                              const inputEl = document.querySelector('input[placeholder*="اكتب"]') as HTMLInputElement;
                              inputEl?.focus();
                            }}
                            className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-brand-600 hover:bg-slate-100 rounded-lg transition-opacity cursor-pointer shrink-0"
                            title="الرد على هذه الرسالة"
                          >
                            <Reply className="w-3.5 h-3.5" />
                          </button>

                          <div
                            className={`rounded-2xl p-3 text-xs shadow-sm min-w-[140px] ${
                              isOutgoing
                                ? 'bg-brand-600 text-white rounded-br-none'
                                : 'bg-white text-slate-800 border border-slate-200/80 rounded-bl-none'
                            }`}
                          >
                            {/* Responder / Sender Header */}
                            {isOutgoing ? (
                              <div className="flex items-center justify-between gap-3 mb-1.5 pb-1 border-b border-white/20 text-[10px]">
                                <span className="font-bold text-white flex items-center gap-1 truncate">
                                  <UserCheck className="w-3 h-3 text-cyan-200 shrink-0" />
                                  <span className="truncate">{getEmployeeSenderName(msg)}</span>
                                </span>
                                <span className="text-[9px] text-white/90 bg-white/20 px-1.5 py-0.5 rounded font-medium shrink-0">
                                  {msg.senderId === user?.id ? 'أنت' : 'فريق العمل'}
                                </span>
                              </div>
                            ) : (
                              <div className="flex items-center justify-between gap-3 mb-1 pb-1 border-b border-slate-100 text-[10px]">
                                <span className="font-bold text-slate-700 flex items-center gap-1 truncate">
                                  <span className="truncate">{msg.senderName || selectedConversation.customerName || 'العميل'}</span>
                                </span>
                                <span className="text-[9px] text-slate-400 font-medium shrink-0">
                                  عميل
                                </span>
                              </div>
                            )}

                            {/* Quoted / Replied Message Box if present */}
                            {(msg.metadata?.quoted || (msg as any).quoted) && (
                              <div
                                className={`mb-2 p-2 rounded-xl text-[11px] border-r-2 ${
                                  isOutgoing
                                    ? 'bg-black/15 border-cyan-300 text-white'
                                    : 'bg-slate-100 border-brand-500 text-slate-800'
                                }`}
                              >
                                <div className="flex items-center gap-1 font-bold text-[10px] opacity-85 mb-0.5">
                                  <Reply className="w-3 h-3 rotate-180 shrink-0" />
                                  <span>رداً على:</span>
                                  <span className="truncate">
                                    {(msg.metadata?.quoted as any)?.sender ||
                                      (msg as any).quoted?.sender ||
                                      'رسالة سابقة'}
                                  </span>
                                </div>
                                <p className="truncate opacity-90 text-[10px]">
                                  {(msg.metadata?.quoted as any)?.text || (msg as any).quoted?.text}
                                </p>
                              </div>
                            )}

                            {/* Image rendering with click-to-preview lightbox */}
                            {isImage && mediaUrl && (
                              <div className="mb-2 rounded-xl overflow-hidden cursor-pointer group relative">
                                <img
                                  src={mediaUrl}
                                  alt={msg.content || 'صورة'}
                                  onClick={() => setActiveLightboxUrl(mediaUrl)}
                                  className="max-h-72 w-auto object-cover rounded-xl hover:opacity-95 transition-opacity"
                                  loading="lazy"
                                />
                                <div
                                  onClick={() => setActiveLightboxUrl(mediaUrl)}
                                  className="absolute inset-0 bg-black/25 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity rounded-xl"
                                >
                                  <span className="p-1.5 bg-black/60 rounded-full text-white">
                                    <Maximize2 className="w-4 h-4" />
                                  </span>
                                </div>
                              </div>
                            )}

                            {/* Video rendering */}
                            {isVideo && mediaUrl && (
                              <div className="mb-2 rounded-xl overflow-hidden">
                                <video src={mediaUrl} controls className="max-h-72 rounded-xl max-w-full" />
                              </div>
                            )}

                            {/* Audio rendering */}
                            {isAudio && mediaUrl && (
                              <div className="mb-2 p-1.5 bg-black/10 rounded-xl">
                                <audio src={mediaUrl} controls className="w-60 max-w-full" />
                              </div>
                            )}

                            {/* Document attachment card */}
                            {isDocument && (
                              <a
                                href={mediaUrl || '#'}
                                target="_blank"
                                rel="noreferrer"
                                className={`flex items-center gap-2.5 p-2 rounded-xl mb-2 transition-colors ${
                                  isOutgoing
                                    ? 'bg-white/15 hover:bg-white/25 text-white'
                                    : 'bg-slate-100 hover:bg-slate-200 text-slate-800'
                                }`}
                              >
                                <div className="p-2 bg-brand-500 text-white rounded-lg">
                                  <FileText className="w-5 h-5" />
                                </div>
                                <div className="flex-1 min-w-0 text-right">
                                  <p className="font-bold text-xs truncate">
                                    {mediaItem?.fileName || msg.content || 'مستند مرفق'}
                                  </p>
                                  {mediaItem?.fileSize && (
                                    <p className="text-[10px] opacity-75">
                                      {Math.round(mediaItem.fileSize / 1024)} كيلوبايت
                                    </p>
                                  )}
                                </div>
                                <Download className="w-4 h-4 shrink-0" />
                              </a>
                            )}

                            {/* Text content if present */}
                            {msg.content &&
                              (!isImage || (msg.content !== '[صورة]' && !msg.content.startsWith('data:'))) &&
                              (!isDocument || !msg.content.startsWith('[ملف')) && (
                                <p className="leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                              )}

                            {/* Timestamp & Delivery status ticks */}
                            <div
                              className={`flex items-center justify-end gap-1 mt-1 text-[10px] ${
                                isOutgoing ? 'text-brand-200' : 'text-slate-400'
                              }`}
                            >
                              <span>
                                {new Date(msg.timestamp).toLocaleTimeString('ar-SA', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </span>
                              {isOutgoing && (
                                <span>
                                  {msg.status === 'read' ? (
                                    <CheckCheck className="w-3 h-3 text-cyan-300" />
                                  ) : msg.status === 'delivered' ? (
                                    <CheckCheck className="w-3 h-3" />
                                  ) : msg.status === 'sent' ? (
                                    <Check className="w-3 h-3" />
                                  ) : (
                                    <Loader2 className="w-3 h-3 animate-spin text-brand-200" />
                                  )}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Staged Media Attachments Tray (WhatsApp Style) */}
              {stagedFiles.length > 0 && (
                <div className="p-3 bg-slate-100/90 border-t border-slate-200 flex flex-col gap-2">
                  <div className="flex items-center justify-between text-xs text-slate-700 font-semibold px-1">
                    <span className="flex items-center gap-1.5">
                      <Paperclip className="w-3.5 h-3.5 text-brand-600" />
                      <span>{stagedFiles.length} ملفات جاهزة للإرسال</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setStagedFiles([])}
                      className="text-[11px] text-red-600 hover:text-red-800 underline cursor-pointer"
                    >
                      إلغاء الكل
                    </button>
                  </div>
                  <div className="flex items-center gap-2 overflow-x-auto pb-1">
                    {stagedFiles.map((item) => (
                      <div
                        key={item.id}
                        className="relative group shrink-0 w-20 h-20 rounded-xl overflow-hidden border border-slate-300 bg-white flex flex-col items-center justify-center shadow-sm"
                      >
                        {item.type === 'image' ? (
                          <img
                            src={item.previewUrl}
                            alt={item.name}
                            className="w-full h-full object-cover rounded-lg"
                          />
                        ) : (
                          <div className="text-center p-1">
                            <FileText className="w-6 h-6 text-brand-600 mx-auto mb-1" />
                            <p className="text-[9px] font-bold text-slate-700 truncate max-w-[4.5rem]">
                              {item.name}
                            </p>
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={() => setStagedFiles((prev) => prev.filter((f) => f.id !== item.id))}
                          className="absolute top-1 right-1 p-0.5 bg-black/60 hover:bg-black/80 text-white rounded-full transition-colors cursor-pointer"
                          title="إزالة"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}

                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="shrink-0 w-20 h-20 rounded-xl border-2 border-dashed border-slate-300 hover:border-brand-500 bg-white hover:bg-brand-50/50 flex flex-col items-center justify-center gap-1 text-slate-500 hover:text-brand-600 transition-colors cursor-pointer"
                      title="إضافة المزيد من الصور أو الملفات"
                    >
                      <Plus className="w-5 h-5" />
                      <span className="text-[10px] font-bold">إضافة</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Quoted Message Active Banner */}
              {replyingTo && (
                <div className="px-4 py-2 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-700 animate-in fade-in">
                  <div className="flex items-center gap-2 min-w-0">
                    <Reply className="w-4 h-4 text-brand-600 shrink-0" />
                    <div className="min-w-0 text-right">
                      <span className="font-bold text-brand-700 text-[11px]">
                        الرد على {replyingTo.senderName || (replyingTo.senderType === 'employee' ? getEmployeeSenderName(replyingTo) : 'العميل')}:
                      </span>
                      <span className="truncate block text-slate-500 text-[10px]">
                        {replyingTo.content || (replyingTo.messageType === 'image' ? '[صورة]' : '[ملف]')}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setReplyingTo(null)}
                    className="p-1 hover:bg-slate-200 rounded-full text-slate-400 hover:text-slate-600 cursor-pointer"
                    title="إلغاء الرد المقتبس"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* Message Composer */}
              <form
                onSubmit={handleSendMessage}
                onPaste={handlePaste}
                className="p-3 bg-white border-t border-slate-200 flex items-center gap-2"
              >
                {/* Hidden Multi-file input */}
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files) handleFilesSelected(e.target.files);
                    e.target.value = '';
                  }}
                />

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="p-2 text-slate-500 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors cursor-pointer"
                  title="إرفاق صور أو وسائط أو مستندات (يمكنك اختيار عدة صور معاً)"
                >
                  <Paperclip className="w-4 h-4" />
                </button>

                <input
                  type="text"
                  placeholder={
                    stagedFiles.length > 0
                      ? 'أضف تعليقاً على الصور/الملفات ثم اضغط إرسال...'
                      : 'اكتب ردك للعميل هنا أو الصق صوراً بالضغط على Ctrl+V...'
                  }
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  disabled={isUploadingMedia}
                  className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-xs focus:outline-none focus:border-brand-500"
                />

                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  disabled={isUploadingMedia}
                  icon={
                    isUploadingMedia ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Send className="w-3.5 h-3.5" />
                    )
                  }
                >
                  {isUploadingMedia ? 'جارٍ الإرسال...' : 'إرسال'}
                </Button>
              </form>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center p-8">
              <EmptyState
                icon={<MessageSquare className="w-6 h-6" />}
                title="اختر محادثة من القائمة"
                description="صندوق المحادثات الموحد يتيح لك الرد على رسائل جميع القنوات من شاشة مركزية واحدة."
              />
            </div>
          )}
        </div>

        {/* COLUMN 3: Customer Information Panel */}
        <div
          className={`w-full lg:w-80 border-r border-slate-200 bg-white flex flex-col shrink-0 overflow-y-auto ${
            mobileTab !== 'info' ? 'hidden lg:flex' : 'flex'
          }`}
        >
          {mobileTab === 'info' && (
            <div className="p-3 border-b border-slate-200 lg:hidden flex items-center justify-between">
              <span className="font-bold text-xs">معلومات العميل</span>
              <button
                onClick={() => setMobileTab('chat')}
                className="text-xs text-brand-600 font-bold"
              >
                العودة للمحادثة
              </button>
            </div>
          )}

          {selectedConversation ? (
            <div className="p-5 space-y-6">
              {/* Customer Profile Header */}
              <div className="text-center pb-2">
                <div className="w-16 h-16 rounded-full bg-slate-100 border-2 border-brand-500/20 text-brand-600 font-bold text-xl flex items-center justify-center mx-auto mb-2">
                  {selectedConversation.customerName.charAt(0)}
                </div>
                <h3 className="font-bold text-sm text-slate-800">
                  {selectedConversation.customerName}
                </h3>
                <div className="mt-2 flex items-center justify-center gap-2">
                  <Badge variant="brand" size="sm">
                    {activeCustomer?.leadStatus === 'new'
                      ? 'عميل جديد'
                      : activeCustomer?.leadStatus === 'contacted'
                      ? 'تم التواصل'
                      : activeCustomer?.leadStatus === 'qualified'
                      ? 'مؤهل للشراء'
                      : activeCustomer?.leadStatus === 'proposal'
                      ? 'عرض سعر'
                      : activeCustomer?.leadStatus === 'won'
                      ? 'عميل حالي'
                      : activeCustomer?.leadStatus === 'lost'
                      ? 'ملغي'
                      : 'عميل جديد'}
                  </Badge>
                  <ChannelIcon channel={selectedConversation.channel} showLabel />
                </div>
                <button
                  onClick={openEditCustomerModal}
                  className="mt-3 px-3 py-1 bg-slate-100 hover:bg-brand-50 text-slate-700 hover:text-brand-700 border border-slate-200 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Edit className="w-3.5 h-3.5 text-brand-600" />
                  <span>تعديل بيانات العميل</span>
                </button>
              </div>

              {/* Contact Information */}
              <div className="space-y-2.5 pt-3 border-t border-slate-100 text-xs">
                <div className="flex items-center justify-between">
                  <h5 className="font-bold text-slate-700">بيانات التواصل:</h5>
                  <button
                    onClick={openEditCustomerModal}
                    className="text-[11px] text-brand-600 hover:text-brand-800 underline cursor-pointer"
                  >
                    تعديل
                  </button>
                </div>
                <div className="flex items-center justify-between text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-100">
                  <div className="flex items-center gap-2">
                    <Phone className="w-3.5 h-3.5 text-slate-400" />
                    <span dir="ltr" className="font-mono text-left font-semibold text-slate-800">
                      {selectedConversation.customerPhone || 'غير مسجل'}
                    </span>
                  </div>
                  <span className="text-[10px] text-green-700 bg-green-100/70 px-1.5 py-0.5 rounded font-bold">
                    واتساب
                  </span>
                </div>
                <div className="flex items-center gap-2 text-slate-600 px-1">
                  <Mail className="w-3.5 h-3.5 text-slate-400" />
                  <span>{activeCustomer?.email || 'لا يوجد بريد مسجل'}</span>
                </div>
              </div>

              {/* Assignments */}
              <div className="pt-3 border-t border-slate-100 text-xs">
                <div className="flex items-center justify-between mb-2">
                  <h5 className="font-bold text-slate-700 flex items-center gap-1.5">
                    <UserCheck className="w-3.5 h-3.5 text-brand-600" />
                    الموظف المسؤول:
                  </h5>
                  {selectedConversation.assignedEmployeeId && (isManager || selectedConversation.assignedEmployeeId === user?.id) && (
                    <button
                      onClick={() => handleAssignConversation('')}
                      className="text-[11px] text-red-600 hover:text-red-800 underline cursor-pointer"
                    >
                      إلغاء التعيين
                    </button>
                  )}
                </div>

                {isManager ? (
                  <div className="space-y-2">
                    <select
                      value={selectedConversation.assignedEmployeeId || ''}
                      onChange={(e) => handleAssignConversation(e.target.value)}
                      className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2 font-medium text-slate-700 focus:outline-none focus:border-brand-500 cursor-pointer"
                    >
                      <option value="">-- غير معين (متاحة للجميع) --</option>
                      {employees.map((emp) => (
                        <option key={emp.id} value={emp.id}>
                          {emp.name} ({emp.role === 'admin' ? 'مدير' : emp.role === 'manager' ? 'مشرف' : 'موظف'})
                        </option>
                      ))}
                    </select>
                    {user && selectedConversation.assignedEmployeeId !== user.id && (
                      <button
                        onClick={() => handleAssignConversation(user.id)}
                        className="w-full py-1.5 px-3 bg-brand-50 hover:bg-brand-100 text-brand-700 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <UserCheck className="w-3.5 h-3.5" />
                        <span>تعيين المحادثة لي</span>
                      </button>
                    )}
                  </div>
                ) : (
                  <div>
                    {selectedConversation.assignedEmployeeId === user?.id ? (
                      <div className="p-2.5 bg-green-50 border border-green-200 rounded-lg">
                        <div className="flex items-center justify-between">
                          <span className="text-green-800 font-bold flex items-center gap-1.5">
                            <CheckCheck className="w-4 h-4 text-green-600" />
                            معينة لك (أنت المسؤول)
                          </span>
                          <button
                            onClick={() => handleAssignConversation('')}
                            className="text-[11px] text-red-600 hover:text-red-800 underline cursor-pointer"
                          >
                            إتاحة للجميع
                          </button>
                        </div>
                      </div>
                    ) : selectedConversation.assignedEmployeeId ? (
                      <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700">
                        معينة إلى:{' '}
                        <strong className="text-slate-900">{selectedConversation.assignedEmployeeName}</strong>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleAssignConversation(user?.id || '')}
                        className="w-full py-2 px-3 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm transition-colors cursor-pointer"
                      >
                        <UserCheck className="w-4 h-4" />
                        <span>استلام المحادثة (تعيين لي)</span>
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* SLA & Assignment Intelligence */}
              <div className="pt-3 border-t border-slate-100 text-xs space-y-2">
                <div className="flex items-center justify-between">
                  <h5 className="font-bold text-slate-700 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-brand-600" />
                    مؤشرات الرد والتوزيع:
                  </h5>
                  {selectedConversation.isFirstResponseDone ? (
                    <span className="text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3 text-emerald-600" />
                      محمية من السحب
                    </span>
                  ) : (
                    <span className="text-[10px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full font-semibold">
                      قيد متابعة SLA
                    </span>
                  )}
                </div>

                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200/80 space-y-1.5 text-[11px]">
                  <div className="flex items-center justify-between text-slate-600">
                    <span>حالة الرد الأول:</span>
                    <strong className={selectedConversation.isFirstResponseDone ? 'text-emerald-700' : 'text-blue-700'}>
                      {selectedConversation.isFirstResponseDone
                        ? 'تم الرد بنجاح'
                        : selectedConversation.firstResponseDueAt
                        ? selectedConversation.firstResponseDueAt <= Date.now()
                          ? 'تجاوز المهلة المحددة'
                          : `متبقي ${Math.max(1, Math.ceil((selectedConversation.firstResponseDueAt - Date.now()) / 60000))} دقيقة`
                        : 'غير محدد'}
                    </strong>
                  </div>

                  {selectedConversation.firstResponseAt && (
                    <div className="flex items-center justify-between text-slate-500 text-[10px]">
                      <span>وقت أول رد:</span>
                      <span>{new Date(selectedConversation.firstResponseAt).toLocaleTimeString('ar-SA')}</span>
                    </div>
                  )}

                  {selectedConversation.primaryOwnerName && selectedConversation.isSubstitute && (
                    <div className="flex items-center justify-between text-purple-700 text-[10px] bg-purple-50 p-1.5 rounded-lg border border-purple-100">
                      <span>المسؤول الأصلي للعميل:</span>
                      <strong>{selectedConversation.primaryOwnerName}</strong>
                    </div>
                  )}
                </div>
              </div>

              {/* Assignment Audit History */}
              <div className="pt-3 border-t border-slate-100 text-xs">
                <h5 className="font-bold text-slate-700 mb-2 flex items-center gap-1.5">
                  <History className="w-3.5 h-3.5 text-brand-600" />
                  سجل التحويلات والإسناد ({selectedConversation.assignmentHistory?.length || 0}):
                </h5>

                <div className="space-y-1.5 max-h-36 overflow-y-auto">
                  {(!selectedConversation.assignmentHistory || selectedConversation.assignmentHistory.length === 0) ? (
                    <p className="text-[11px] text-slate-400 bg-slate-50 p-2 rounded-lg border border-slate-200 text-center">
                      لا توجد عمليات تحويل مسجلة لهذه المحادثة.
                    </p>
                  ) : (
                    selectedConversation.assignmentHistory.slice().reverse().map((asgn, idx) => (
                      <div key={asgn.id || idx} className="p-2 bg-slate-50 border border-slate-200 rounded-lg text-[10px] space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-800">
                            {asgn.previousEmployeeName ? `${asgn.previousEmployeeName} ← ` : ''}{asgn.assignedToName || 'قائمة الانتظار'}
                          </span>
                          <span className="text-slate-400">
                            {new Date(asgn.assignedAt).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <p className="text-slate-500 leading-tight">{asgn.reason}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Tags */}
              <div className="pt-3 border-t border-slate-100 text-xs">
                <h5 className="font-bold text-slate-700 mb-2 flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5 text-brand-600" />
                  الوسوم (Tags):
                </h5>
                <div className="flex flex-wrap gap-1.5">
                  {selectedConversation.tags.length > 0 ? (
                    selectedConversation.tags.map((t, idx) => (
                      <span
                        key={idx}
                        className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[10px] font-medium"
                      >
                        {t}
                      </span>
                    ))
                  ) : (
                    <span className="text-[11px] text-slate-400">لا توجد وسوم مضافة</span>
                  )}
                </div>
              </div>

              {/* Notes */}
              <div className="pt-3 border-t border-slate-100 text-xs">
                <h5 className="font-bold text-slate-700 mb-2 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-brand-600" />
                  الملاحظات الداخلية ({customerNotes.length}):
                </h5>

                {/* Notes List */}
                <div className="space-y-1.5 max-h-40 overflow-y-auto mb-2">
                  {customerNotes.length === 0 ? (
                    <p className="text-[11px] text-slate-400 bg-slate-50 p-2 rounded-lg border border-slate-200 text-center">
                      لا توجد ملاحظات سابقة. أضف ملاحظة خاصة بالعميل أدناه.
                    </p>
                  ) : (
                    customerNotes.map((n) => (
                      <div key={n.id} className="p-2 bg-amber-50/80 border border-amber-200/70 rounded-xl text-amber-950 text-xs space-y-1">
                        <p className="leading-relaxed">{n.content}</p>
                        <div className="flex items-center justify-between text-[10px] text-amber-700">
                          <span>{n.authorName}</span>
                          <span>{new Date(n.createdAt).toLocaleDateString('ar-SA')}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Add Note Input */}
                <form onSubmit={handleAddNote} className="flex gap-1.5">
                  <input
                    type="text"
                    placeholder="اكتب ملاحظة لفريق العمل..."
                    value={newNoteText}
                    onChange={(e) => setNewNoteText(e.target.value)}
                    className="flex-1 px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-brand-500"
                  />
                  <Button
                    type="submit"
                    variant="primary"
                    size="sm"
                    isLoading={isAddingNote}
                  >
                    إضافة
                  </Button>
                </form>
              </div>
            </div>
          ) : (
            <div className="p-6 text-center text-xs text-slate-400">
              اختر محادثة لعرض بيانات العميل والوسوم والملاحظات
            </div>
          )}
        </div>
      </div>

      {/* Modal: Start New Conversation */}
      {isNewConvModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center">
                  <MessageSquare className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-slate-800 text-sm">بدء محادثة جديدة</h3>
              </div>
              <button
                onClick={() => setIsNewConvModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleStartNewConversation} className="p-5 space-y-4">
              {newConvError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs">
                  {newConvError}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  اسم العميل <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="مثال: أحمد عبد الله"
                  value={newConvName}
                  onChange={(e) => setNewConvName(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  رقم الهاتف (واتساب) <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  required
                  placeholder="+201xxxxxxxxx أو 01xxxxxxxxx"
                  value={newConvPhone}
                  onChange={(e) => setNewConvPhone(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-brand-500 text-left font-mono"
                  dir="ltr"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  القناة
                </label>
                <select
                  value={newConvChannel}
                  onChange={(e) => setNewConvChannel(e.target.value as ChannelType)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-brand-500 bg-white"
                >
                  <option value="whatsapp">واتساب (WhatsApp)</option>
                  <option value="website">الموقع المباشر (Website Live Chat)</option>
                  <option value="messenger">ماسنجر (Messenger)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  الرسالة الافتتاحية
                </label>
                <textarea
                  rows={3}
                  placeholder="مرحباً بك، كيف يمكننا مساعدتك اليوم؟"
                  value={newConvMessage}
                  onChange={(e) => setNewConvMessage(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-brand-500 resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsNewConvModalOpen(false)}
                >
                  إلغاء
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  isLoading={isStartingConv}
                  icon={<Send className="w-3.5 h-3.5" />}
                >
                  بدء وإرسال
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Edit Customer */}
      {isEditCustomerOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center">
                  <Edit className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-slate-800 text-sm">تعديل بيانات العميل</h3>
              </div>
              <button
                onClick={() => setIsEditCustomerOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveCustomer} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  اسم العميل <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="مثال: محمد أحمد"
                  value={editCustomerName}
                  onChange={(e) => setEditCustomerName(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  رقم الهاتف (واتساب) <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  required
                  placeholder="+250xxxxxxxxx أو +201xxxxxxxxx"
                  value={editCustomerPhone}
                  onChange={(e) => setEditCustomerPhone(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-brand-500 font-mono text-left"
                  dir="ltr"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  البريد الإلكتروني (اختياري)
                </label>
                <input
                  type="email"
                  placeholder="client@example.com"
                  value={editCustomerEmail}
                  onChange={(e) => setEditCustomerEmail(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-brand-500 text-left font-mono"
                  dir="ltr"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  حالة العميل (Lead Status)
                </label>
                <select
                  value={editCustomerLeadStatus}
                  onChange={(e) => setEditCustomerLeadStatus(e.target.value as LeadStatus)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-brand-500 bg-white"
                >
                  <option value="new">عميل جديد (New)</option>
                  <option value="contacted">تم التواصل (Contacted)</option>
                  <option value="qualified">مؤهل للشراء (Qualified)</option>
                  <option value="proposal">عرض سعر مقدم (Proposal)</option>
                  <option value="won">عميل تم التعاقد معه (Won)</option>
                  <option value="lost">غير مهتم / ملغي (Lost)</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsEditCustomerOpen(false)}
                >
                  إلغاء
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  isLoading={isSavingCustomer}
                >
                  حفظ البيانات
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Lightbox Modal: Full Screen Media Preview */}
      {activeLightboxUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setActiveLightboxUrl(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh] flex flex-col items-center">
            <img
              src={activeLightboxUrl}
              alt="معاينة الصورة"
              className="max-h-[85vh] max-w-full rounded-2xl shadow-2xl object-contain"
              onClick={(e) => e.stopPropagation()}
            />
            <button
              onClick={() => setActiveLightboxUrl(null)}
              className="absolute top-3 left-3 p-2 bg-black/60 hover:bg-black/90 text-white rounded-full cursor-pointer transition-colors"
              title="إغلاق"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
