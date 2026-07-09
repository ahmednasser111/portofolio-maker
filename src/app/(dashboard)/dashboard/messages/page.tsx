import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { listMessages } from "@/features/contact/queries";
import { MessageInbox } from "@/features/contact/components/message-inbox";
import { getDefaultWorkspace } from "@/lib/workspace";

export const dynamic = "force-dynamic";

export default async function DashboardMessagesPage() {
  const workspace = await getDefaultWorkspace();
  const messages = await listMessages(workspace.id);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-xl font-semibold">Messages</h1>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Inbox</CardTitle>
        </CardHeader>
        <CardContent>
          <MessageInbox messages={messages} />
        </CardContent>
      </Card>
    </div>
  );
}
