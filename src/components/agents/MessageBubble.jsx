import ReactMarkdown from 'react-markdown';
import { Bot, User } from 'lucide-react';

export default function MessageBubble({ message, userName }) {
  const isUser = message.role === 'user';
  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
      <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${isUser ? 'bg-primary/15 text-primary' : 'grad-bg text-white'}`}>
        {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
      </span>
      <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${isUser ? 'bg-primary/15 text-foreground' : 'border border-border bg-card'}`}>
        {message.content && (isUser
          ? <p className="whitespace-pre-wrap">{message.content}</p>
          : <ReactMarkdown className="prose prose-sm prose-invert max-w-none">{message.content}</ReactMarkdown>)}
      </div>
    </div>
  );
}