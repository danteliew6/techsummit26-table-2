/**
 * Customer 360 drawer. Opens when the user clicks a customer in the Book of
 * Business. Four tabs — Overview, Why flagged, Next best action (the Act /
 * approve surface), and Activity (the audit trail). Auto-refreshes on
 * dataMutated so the agent's writes reflect live.
 */
import { useEffect, useState } from 'react';
import { Activity } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@databricks/appkit-ui/react';
import { fetchCustomerDetail, type CustomerDetailBundle } from '@/lib/relationships';
import { dataMutated } from '@/lib/events';
import { RiskBandBadge, TierBadge, usd } from '@/shared/badges';

import { NextBestActionTab } from './tabs/ReturnTab';
import { OverviewTab, WhyFlaggedTab } from './tabs/CustomerTab';
import { ActivityTab } from './tabs/ActivityTab';

type Props = {
  id: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onMutated: () => void;
};

export function CustomerDrawer({ id, open, onOpenChange, onMutated }: Props) {
  const [bundle, setBundle] = useState<CustomerDetailBundle | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedTab, setSelectedTab] = useState('overview');

  useEffect(() => {
    if (!id) {
      setBundle(null);
      return;
    }
    // Reset to overview tab when switching to a new customer
    setSelectedTab('overview');
    setLoading(true);
    setError(null);
    fetchCustomerDetail(id)
      .then(setBundle)
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
    const unsub = dataMutated.subscribe(() => {
      if (id) void fetchCustomerDetail(id).then(setBundle).catch(() => {});
    });
    return unsub;
  }, [id]);

  const p = bundle?.position;
  const recommended = bundle?.nba?.recommendedAction;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="!w-full sm:!w-[60vw] sm:!max-w-[60vw] lg:!w-[640px] lg:!max-w-[640px] p-0 flex flex-col"
      >
        {!bundle && loading && (
          <div className="p-8 text-muted-foreground">Loading…</div>
        )}
        {error && <div className="p-8 text-destructive">{error}</div>}
        {bundle && (
          <>
            <SheetHeader className="px-8 pt-8 pb-4 border-b border-border">
              <div className="flex items-center gap-3">
                {p && <RiskBandBadge band={p.riskBand} />}
                {p && <TierBadge tier={p.tier} />}
                {p?.homeMetro && (
                  <span className="text-xs text-muted-foreground">{p.homeMetro}</span>
                )}
              </div>
              <SheetTitle className="display text-2xl font-mono">
                {bundle.customerId}
              </SheetTitle>
              <SheetDescription className="flex items-center gap-2 flex-wrap">
                {p && <span>{usd(p.balanceAtRiskUsd)} balance at risk</span>}
                {p?.minDaysToMaturity != null && (
                  <>
                    <span className="text-muted-foreground">·</span>
                    <span className="text-muted-foreground">
                      matures in {p.minDaysToMaturity} days
                    </span>
                  </>
                )}
              </SheetDescription>
            </SheetHeader>
            <Tabs value={selectedTab} onValueChange={setSelectedTab} className="flex-1 flex flex-col min-h-0">
              <TabsList className="mx-8 mt-4 w-fit">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="why">Why flagged</TabsTrigger>
                <TabsTrigger value="nba">
                  Next best action
                  {recommended ? ' •' : ''}
                </TabsTrigger>
                <TabsTrigger value="activity">
                  <Activity className="size-3.5 mr-1" />
                  Activity{bundle.actions.length > 0 && ` (${bundle.actions.length})`}
                </TabsTrigger>
              </TabsList>
              <TabsContent value="overview" className="flex-1 overflow-y-auto px-8 py-6 pb-32">
                <OverviewTab bundle={bundle} />
              </TabsContent>
              <TabsContent value="why" className="flex-1 overflow-y-auto px-8 py-6 pb-32">
                <WhyFlaggedTab bundle={bundle} />
              </TabsContent>
              <TabsContent value="nba" className="flex-1 overflow-y-auto px-8 py-6 pb-32">
                <NextBestActionTab bundle={bundle} onMutated={onMutated} />
              </TabsContent>
              <TabsContent value="activity" className="flex-1 overflow-y-auto px-8 py-6 pb-32">
                <ActivityTab actions={bundle.actions} />
              </TabsContent>
            </Tabs>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
