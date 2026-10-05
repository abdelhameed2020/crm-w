import React from 'react';
import type { ChannelType } from '../../types/channel.types';
import { MessageSquare, Globe, PhoneCall } from 'lucide-react';

export interface ChannelIconProps {
  channel: ChannelType;
  className?: string;
  showLabel?: boolean;
}

export const ChannelIcon: React.FC<ChannelIconProps> = ({
  channel,
  className = 'w-4 h-4',
  showLabel = false,
}) => {
  const getChannelDetails = () => {
    switch (channel) {
      case 'whatsapp':
        return {
          label: 'واتساب',
          color: 'text-emerald-600 bg-emerald-50 border-emerald-200',
          dot: 'bg-emerald-500',
        };
      case 'messenger':
        return {
          label: 'ماسنجر',
          color: 'text-blue-600 bg-blue-50 border-blue-200',
          dot: 'bg-blue-500',
        };
      case 'instagram':
        return {
          label: 'انستغرام',
          color: 'text-pink-600 bg-pink-50 border-pink-200',
          dot: 'bg-pink-500',
        };
      case 'website':
      default:
        return {
          label: 'شات الموقع',
          color: 'text-indigo-600 bg-indigo-50 border-indigo-200',
          dot: 'bg-indigo-500',
        };
    }
  };

  const details = getChannelDetails();

  const renderIcon = () => {
    switch (channel) {
      case 'whatsapp':
        return <PhoneCall className={className} />;
      case 'website':
        return <Globe className={className} />;
      default:
        return <MessageSquare className={className} />;
    }
  };

  if (!showLabel) {
    return <span className={`inline-flex items-center ${details.color.split(' ')[0]}`}>{renderIcon()}</span>;
  }

  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border ${details.color}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${details.dot}`}></span>
      {renderIcon()}
      <span>{details.label}</span>
    </span>
  );
};
