import React, { useState, useEffect } from 'react';
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
  MessageSquare
} from 'lucide-react';
import { ChannelIcon } from '../../components/common/ChannelIcon';
import { Badge } from '../../components/common/Badge';
import { EmptyState } from '../../components/common/EmptyState';
import { Button } from '../../components/common/Button';
import type { Conversation, ConversationStatus } from '../../types/conversation.types';
import type { ChannelType } from '../../types/channel.types';
import type { Message } from '../../types/message.types';
import type { Customer } from '../../types/customer.types';
import { ConversationsService } from '../../services/firebase/conversations.service';
import { MessagesService } from '../../services/firebase/messages.service';
import { CustomersService } from '../../services/firebase/customers.service';
import { useAuth } from '../../hooks/useAuth';

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

  // Mobile View state
  const [mobileTab, setMobileTab] = useState<'list' | 'chat' | 'info'>('list');

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
        setConversationsError('تعذر تحميل المحادثات. يرجى التحقق من الصلاحيات والاتصال.');
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

  // Outbound message send
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageInput.trim() || !selectedConversation) return;

    const newMessage: Message = {
      id: `msg_${Date.now()}`,
      conversationId: selectedConversation.id,
      customerId: selectedConversation.customerId,
      channel: selectedConversation.channel,
      senderType: 'employee',
      senderId: user?.id || 'emp_1',
      senderName: user?.displayName || 'الموظف',
      content: messageInput.trim(),
      messageType: 'text',
      status: 'sending',
      timestamp: Date.now(),
    };

    setMessageInput('');
    try {
      await MessagesService.createMessage(newMessage);
      // Status update simulation in foundation
      setTimeout(() => {
        MessagesService.updateMessageStatus(newMessage.id, 'sent');
      }, 500);
    } catch (err) {
      console.error('Failed to send message:', err);
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

        {/* Status Dropdown */}
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
                  description="صندوق المحادثات الموحد يستمع إلى قنوات WhatsApp وMessenger والموقع. المحادثات الواردة ستظهر فوراً هنا."
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
                      {conv.assignedEmployeeName && (
                        <span className="text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                          {conv.assignedEmployeeName}
                        </span>
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
          className={`flex-1 flex flex-col bg-slate-50/50 overflow-hidden ${
            mobileTab !== 'chat' ? 'hidden md:flex' : 'flex'
          }`}
        >
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
                    <p className="text-[11px] text-slate-400">
                      معين إلى:{' '}
                      <strong className="text-slate-600">
                        {selectedConversation.assignedEmployeeName || 'غير معين'}
                      </strong>
                    </p>
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
                    return (
                      <div
                        key={msg.id}
                        className={`flex flex-col ${isOutgoing ? 'items-end' : 'items-start'}`}
                      >
                        <div
                          className={`max-w-[75%] rounded-2xl p-3.5 text-xs shadow-sm ${
                            isOutgoing
                              ? 'bg-brand-600 text-white rounded-br-none'
                              : 'bg-white text-slate-800 border border-slate-200/80 rounded-bl-none'
                          }`}
                        >
                          <p className="leading-relaxed whitespace-pre-wrap">{msg.content}</p>
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
                                ) : (
                                  <Check className="w-3 h-3" />
                                )}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Message Composer */}
              <form
                onSubmit={handleSendMessage}
                className="p-3 bg-white border-t border-slate-200 flex items-center gap-2"
              >
                <button
                  type="button"
                  className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                  title="إرفاق ملف أو وسائط (جاهز للمراحل القادمة)"
                >
                  <Paperclip className="w-4 h-4" />
                </button>
                <input
                  type="text"
                  placeholder="اكتب ردك للعميل هنا..."
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-xs focus:outline-none focus:border-brand-500"
                />
                <Button type="submit" variant="primary" size="sm" icon={<Send className="w-3.5 h-3.5" />}>
                  إرسال
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
              <div className="text-center">
                <div className="w-16 h-16 rounded-full bg-slate-100 border-2 border-brand-500/20 text-brand-600 font-bold text-xl flex items-center justify-center mx-auto mb-2">
                  {selectedConversation.customerName.charAt(0)}
                </div>
                <h3 className="font-bold text-sm text-slate-800">
                  {selectedConversation.customerName}
                </h3>
                <div className="mt-2 flex items-center justify-center gap-2">
                  <Badge variant="brand" size="sm">
                    {activeCustomer?.leadStatus || 'عميل جديد'}
                  </Badge>
                  <ChannelIcon channel={selectedConversation.channel} showLabel />
                </div>
              </div>

              {/* Contact Information */}
              <div className="space-y-2 pt-2 border-t border-slate-100 text-xs">
                <h5 className="font-bold text-slate-700 mb-2">بيانات التواصل:</h5>
                <div className="flex items-center gap-2 text-slate-600">
                  <Phone className="w-3.5 h-3.5 text-slate-400" />
                  <span>{selectedConversation.customerPhone || 'غير مسجل'}</span>
                </div>
                <div className="flex items-center gap-2 text-slate-600">
                  <Mail className="w-3.5 h-3.5 text-slate-400" />
                  <span>{activeCustomer?.email || 'غير مسجل'}</span>
                </div>
              </div>

              {/* Assignments */}
              <div className="pt-2 border-t border-slate-100 text-xs">
                <h5 className="font-bold text-slate-700 mb-2 flex items-center gap-1.5">
                  <UserCheck className="w-3.5 h-3.5 text-brand-600" />
                  الموظف المسؤول:
                </h5>
                <p className="text-slate-600 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                  {selectedConversation.assignedEmployeeName || 'المحادثة متاحة للتعيين'}
                </p>
              </div>

              {/* Tags */}
              <div className="pt-2 border-t border-slate-100 text-xs">
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
              <div className="pt-2 border-t border-slate-100 text-xs">
                <h5 className="font-bold text-slate-700 mb-2 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-brand-600" />
                  الملاحظات الداخلية:
                </h5>
                <div className="p-3 bg-amber-50/60 border border-amber-200/60 rounded-xl text-amber-900 text-xs leading-relaxed">
                  ملاحظة معمارية: هذا القسم متصل بجدول Notes في Firestore لتدوين ملاحظات الفريق الداخلية على العميل.
                </div>
              </div>
            </div>
          ) : (
            <div className="p-6 text-center text-xs text-slate-400">
              اختر محادثة لعرض بيانات العميل والوسوم والملاحظات
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
