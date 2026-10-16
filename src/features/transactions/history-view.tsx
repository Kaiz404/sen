import { FlashList, type ListRenderItemInfo } from '@shopify/flash-list';
import { type ReactNode, useEffect } from 'react';
import { Text, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { EnterOnce } from '@/components/enter-once';
import { Key } from '@/components/key';
import type { Biometric, DbResetReason } from '@/features/auth';
import { releaseSenScroll, Sen, senScroll } from '@/features/sen';
import type { DayKey, Instant } from '@/models/day';
import type { TxId } from '@/models/transaction';
import { mark } from '@/services/perf';
import type { Flow, MaskedTotals } from '@/services/tx-repo';
import { type } from '@/theme/type';

import type { Banner, HistoryBody } from './body';
import {
  DayNet,
  DayTop,
  Header,
  LoadingCard,
  MonthCard,
  MonthTop,
  NoteLine,
  ResultLine,
  SearchAndFilter,
  SyncBanner,
  TxRow,
} from './parts';
import { RevealedAmounts, type Revealed } from './reveal';
import { type HistoryItem, isArrival, monthName, monthSoFar } from './rows';
import { EmptyHistory, FullError, NoResults, SkeletonSlips } from './states';

export type HistoryActions = {
  readonly onSearch: (text: string) => void;
  readonly onFlow: (flow: Flow) => void;
  readonly onShow: () => void;
  readonly onHide: () => void;
  readonly onRefresh: () => void;
  readonly onRetry: () => void;
  readonly onEndReached: () => void;
  readonly onAdd: () => void;
  readonly onSettings: () => void;
  /** Settings scrolled to the reviewer controls, from a simulated fault. */
  readonly onReviewerSettings: () => void;
  readonly onLock: () => void;
  readonly onOpen: (id: TxId) => void;
  readonly onDismissNotice: () => void;
};

export type HistoryViewProps = {
  readonly today: DayKey;
  readonly body: HistoryBody;
  readonly hidden: boolean;
  readonly search: string;
  readonly flow: Flow;
  readonly monthCounts: MaskedTotals | undefined;
  readonly resultCounts: MaskedTotals | undefined;
  readonly banner: Banner | null;
  readonly skipped: number;
  readonly notice: DbResetReason | null;
  readonly refreshing: boolean;
  /** The newest row before the last refresh. Rows after it slide in once. */
  readonly arrival: { readonly postedAt: Instant; readonly id: TxId } | null;
  /** How many rows the last pull brought, while its pill shows. */
  readonly updated: number | null;
  readonly biometric: Biometric;
  /** The amounts, only while shown and once they arrive. */
  readonly revealed: Revealed | null;
  readonly actions: HistoryActions;
};

const NO_ITEMS: readonly HistoryItem[] = [];

const NET_LABEL: Readonly<Record<Flow, string>> = { all: 'DAY NET', in: 'DAY IN', out: 'DAY OUT' };

const NOTICE: Readonly<Record<DbResetReason, string>> = {
  missing_key:
    "Sen couldn't find its key on this phone, so it started a fresh, empty store. Your bank history syncs back.",
  corrupt:
    "Sen couldn't read its saved data, so it started a fresh store. Your bank history syncs back.",
};

/** History drawn from props, so the gallery can draw every state without a database. */
export function HistoryView(props: HistoryViewProps): ReactNode {
  const { body, search, flow, actions, arrival, banner } = props;
  const searching = search.trim() !== '';
  const listShown = body.kind !== 'failed';
  // The list can go mid-fling, to a lock or to the full error, before its end event reopens the gate.
  useEffect(() => (listShown ? releaseSenScroll : undefined), [listShown]);
  const netLabel = searching ? 'MATCHES' : NET_LABEL[flow];

  const renderItem = ({ item }: ListRenderItemInfo<HistoryItem>) => {
    switch (item.kind) {
      case 'day':
        return <DayTop title={item.title} caption={item.caption} />;
      case 'tx': {
        const row = <TxRow row={item.row} first={item.first} onOpen={actions.onOpen} />;
        return isArrival(arrival, item.row) ? <EnterOnce>{row}</EnterOnce> : row;
      }
      case 'net':
        return <DayNet day={item.day} label={netLabel} />;
    }
  };

  const top = (
    <View style={styles.top}>
      {props.notice !== null && (
        <View style={styles.notice}>
          <NoteLine icon="database-refresh" text={NOTICE[props.notice]} />
          <Key tone="outline" label="Got it" onPress={actions.onDismissNotice} />
        </View>
      )}
      <MonthTop
        month={monthName(props.today)}
        soFar={monthSoFar(props.today)}
        compact={searching}
      />
      {body.kind === 'loading' ? (
        <LoadingCard />
      ) : (
        !searching && (
          <MonthCard
            flow={flow}
            hidden={props.hidden}
            counts={props.monthCounts}
            asOf={banner?.since ?? null}
            biometric={props.biometric}
            onShow={actions.onShow}
            onHide={actions.onHide}
          />
        )
      )}
      <SearchAndFilter
        search={search}
        flow={flow}
        onSearch={actions.onSearch}
        onFlow={actions.onFlow}
      />
      {searching && <ResultLine counts={props.resultCounts} hidden={props.hidden} />}
      {props.skipped > 0 && (
        <NoteLine
          icon="alert-circle-outline"
          text={`${props.skipped} ${props.skipped === 1 ? "item couldn't" : "items couldn't"} be read`}
        />
      )}
    </View>
  );

  const empty = (() => {
    switch (body.kind) {
      case 'loading':
        return <SkeletonSlips />;
      case 'empty':
        return <EmptyHistory />;
      case 'no-results':
        return <NoResults search={search} onClear={() => actions.onSearch('')} />;
      case 'failed':
      case 'list':
        return null;
    }
  })();

  return (
    <RevealedAmounts value={props.revealed}>
      <View testID="history" style={styles.screen}>
        {banner !== null && (
          <SyncBanner
            banner={banner}
            onRetry={actions.onRetry}
            onSettings={actions.onReviewerSettings}
          />
        )}
        <Header
          inset={banner === null}
          onAdd={actions.onAdd}
          onSettings={actions.onSettings}
          onLock={actions.onLock}
        />
        {body.kind === 'failed' ? (
          <FullError
            error={body.error}
            onRetry={actions.onRetry}
            onSettings={actions.onReviewerSettings}
          />
        ) : (
          <View style={styles.listSlot}>
            <FlashList
              testID="history-list"
              data={body.kind === 'list' ? body.rows.items : NO_ITEMS}
              renderItem={renderItem}
              keyExtractor={(item) => item.key}
              getItemType={(item) => item.kind}
              stickyHeaderIndices={body.kind === 'list' ? body.rows.sticky : undefined}
              extraData={arrival}
              onLoad={painted}
              ListHeaderComponent={top}
              ListEmptyComponent={empty}
              ListFooterComponent={
                <View style={styles.footer}>
                  {banner !== null && body.kind === 'list' && (
                    <Text style={styles.footerText}>PULL DOWN TO TRY AGAIN</Text>
                  )}
                </View>
              }
              refreshing={props.refreshing}
              onRefresh={actions.onRefresh}
              onEndReached={actions.onEndReached}
              onEndReachedThreshold={0.5}
              onScrollBeginDrag={scrolling}
              onMomentumScrollBegin={scrolling}
              onScrollEndDrag={still}
              onMomentumScrollEnd={still}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
            />
            {props.refreshing && (
              <View pointerEvents="none" style={styles.pullSlot}>
                <Sen pose="look" size={56} label="Sen, checking with your bank" />
              </View>
            )}
            {props.updated !== null && (
              <View pointerEvents="none" accessibilityLiveRegion="polite" style={styles.pill}>
                <Sen pose="happy" size={22} />
                <Text style={styles.pillText}>
                  {props.updated === 0
                    ? 'Updated just now'
                    : `Updated just now · ${props.updated} new`}
                </Text>
              </View>
            )}
          </View>
        )}
      </View>
    </RevealedAmounts>
  );
}

const painted = () => mark('history.painted');

/** Sen holds still while the list moves, and for 1.5 s after it stops (DESIGN › Motion rules). */
const scrolling = () => senScroll(true);
const still = () => senScroll(false);

const styles = StyleSheet.create((theme, rt) => ({
  screen: { flex: 1, backgroundColor: theme.colors.canvas },
  listSlot: { flex: 1 },
  top: { paddingHorizontal: 20, paddingTop: 6, paddingBottom: 4, gap: 18 },
  notice: {
    gap: 10,
    padding: 14,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: theme.colors.rule,
    backgroundColor: theme.colors.paper,
  },
  footer: { paddingTop: 24, paddingBottom: rt.insets.bottom + 28, alignItems: 'center' },
  footerText: { ...type.caption(11), color: theme.colors.inkMuted },
  pullSlot: { position: 'absolute', top: 8, left: 0, right: 0, alignItems: 'center' },
  pill: {
    position: 'absolute',
    top: 10,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingLeft: 8,
    paddingRight: 14,
    borderRadius: 999,
    backgroundColor: theme.colors.loud,
  },
  pillText: { fontSize: 13, fontWeight: '700', color: theme.colors.onLoud },
}));
