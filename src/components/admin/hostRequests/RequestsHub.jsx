import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import HostRequestsPanel from '@/components/admin/hostRequests/HostRequestsPanel';

export default function RequestsHub({ hostRequests = [], onChanged }) {
  const navigate = useNavigate();

  return (
    <div className="bg-white rounded-lg shadow px-5 mb-8">
      <Accordion type="single" collapsible defaultValue="host">
        <AccordionItem value="host">
          <AccordionTrigger className="font-bold text-stone-900">
            Host a Challenge Requests ({hostRequests.length})
          </AccordionTrigger>
          <AccordionContent>
            <HostRequestsPanel
              requests={hostRequests}
              onChanged={onChanged}
            />
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="sponsors" className="border-b-0">
          <AccordionTrigger className="font-bold text-stone-900">Sponsorship Enquiries</AccordionTrigger>
          <AccordionContent>
            <p className="text-sm text-stone-500 mb-3">Sponsorship applications are managed in the Sponsors tab.</p>
            <Button variant="outline" size="sm" onClick={() => navigate('/dashboard?tab=sponsors')}>Go to Sponsors tab</Button>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}