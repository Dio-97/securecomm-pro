import { format } from "date-fns";
import { Lock, CheckCheck, Edit } from "lucide-react";
import type { Message } from "@shared/schema";

interface MessageBubbleProps {
  message: Message;
  isOwnMessage: boolean;
  canEdit?: boolean;
  onEdit?: (messageId: string, newContent: string) => void;
}

export function MessageBubble({ message, isOwnMessage, canEdit, onEdit }: MessageBubbleProps) {
  const handleEdit = () => {
    if (!canEdit || !onEdit) return;
    
    const newContent = prompt("Edit message:", message.content);
    if (newContent !== null && newContent !== message.content) {
      onEdit(message.id, newContent);
    }
  };

  const timestamp = message.timestamp ? format(new Date(message.timestamp), "HH:mm") : "";

  return (
    <div className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[70%] px-4 py-3 rounded-2xl shadow-sm ${
        isOwnMessage 
          ? 'bg-blue-600 text-white rounded-br-md' 
          : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 border rounded-bl-md'
      }`}>
        <p className="text-sm break-words font-medium text-foreground">{message.content}</p>
        <div className={`flex items-center mt-1 space-x-1 ${isOwnMessage ? 'justify-end' : 'justify-start'}`}>
          <span className="text-xs opacity-75">{timestamp}</span>
          {isOwnMessage && <CheckCheck className="w-3 h-3 opacity-75" />}
          <Lock className="w-3 h-3 opacity-75" />
          {canEdit && (
            <Edit 
              className="w-3 h-3 opacity-75 cursor-pointer ml-2 hover:opacity-100" 
              onClick={handleEdit}
            />
          )}
        </div>
        {message.editedAt && (
          <div className="text-xs opacity-50 mt-1">
            Edited {format(new Date(message.editedAt), "HH:mm")}
          </div>
        )}
      </div>
    </div>
  );
}
