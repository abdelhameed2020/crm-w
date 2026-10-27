import React, { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { processGatewaySync } from '../services/channels/gatewaySyncWorker';
import { SlaMonitorService } from '../services/assignment/SlaMonitorService';
import { AutoAssignmentService } from '../services/assignment/AutoAssignmentService';

export const AppLayout: React.FC = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Global background services: Inbound WhatsApp Sync, SLA Escalation, and Waiting Queue Processing
  useEffect(() => {
    // 1. Process WhatsApp Gateway Sync periodically
    processGatewaySync();
    const syncTimer = setInterval(() => {
      processGatewaySync();
    }, 4000);

    // 2. First Response SLA Monitor & Waiting Queue Auto-Assignment periodically (every 10 seconds)
    const runSlaAndQueue = async () => {
      try {
        await SlaMonitorService.checkAndEscalateBreachedConversations();
        await AutoAssignmentService.processWaitingQueue();
      } catch (err) {
        console.warn('Background SLA/Queue check warning:', err);
      }
    };

    runSlaAndQueue();
    const slaTimer = setInterval(runSlaAndQueue, 10000);

    return () => {
      clearInterval(syncTimer);
      clearInterval(slaTimer);
    };
  }, []);

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden font-sans">
      {/* Sidebar (Desktop static, Mobile drawer) */}
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        <Topbar onMenuClick={() => setIsSidebarOpen(true)} />

        <main className="flex-1 overflow-y-auto bg-slate-50/70 p-4 sm:p-6 lg:p-8">
          <div className="max-w-7xl mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};
