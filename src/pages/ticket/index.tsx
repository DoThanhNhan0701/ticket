import { Ticket } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";

export function TicketPage() {
  return (
    <div className="flex min-h-0 w-full flex-1 flex-col gap-2 sm:gap-5">
      <PageHeader
        title="Ticket"
        description="Your internal ticket workspace."
        icon={Ticket}
      />
    </div>
  );
}
