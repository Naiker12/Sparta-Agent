import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { WorkInboxPage } from "@/features/work/work-inbox-page";
import { AutomationsPage } from "./automations-page";

export function TasksPage() {
  return <Tabs defaultValue="inbox" className="w-full">
    <div className="mx-auto w-full max-w-5xl px-5 pt-5 md:px-8"><TabsList aria-label="Trabajo"><TabsTrigger value="inbox">Bandeja de trabajo</TabsTrigger><TabsTrigger value="automations">Automatizaciones</TabsTrigger></TabsList></div>
    <TabsContent value="inbox"><WorkInboxPage /></TabsContent>
    <TabsContent value="automations"><AutomationsPage /></TabsContent>
  </Tabs>;
}
