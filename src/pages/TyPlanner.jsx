import { Link } from 'react-router-dom';
import { ArrowLeft, Bot } from 'lucide-react';
import AgentChat from '@/components/agents/AgentChat';

export default function TyPlanner() {
  return (
    <div className="container-tight py-12">
      <Link to="/" className="mb-5 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back
      </Link>
      <div className="mb-6 flex items-start gap-4">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl grad-bg text-white">
          <Bot className="h-6 w-6" />
        </span>
        <div>
          <p className="text-sm font-semibold uppercase tracking-wider text-primary">AI Challenge Planner</p>
          <h1 className="mt-1 font-heading text-3xl font-extrabold sm:text-4xl">Ty — your planning assistant</h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            When a brand submits a proposal, Ty automatically drafts a challenge plan (title, theme, brief, timeline and prize structure) and saves it to the proposal. Chat here to refine ideas or plan a new challenge.
          </p>
        </div>
      </div>
      <AgentChat
        agentName="ty"
        greeting="Hi! I'm Ty. Share a proposal or ask me to plan a challenge and I'll draft a title, theme, brief, timeline and prize structure."
      />
    </div>
  );
}