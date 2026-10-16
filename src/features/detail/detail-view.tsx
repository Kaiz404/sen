import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { ReactNode } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { Bone } from '@/components/bone';
import { Key } from '@/components/key';
import { Leader, ReceiptSlip, SlipRule } from '@/components/receipt-slip';
import { Stamp } from '@/components/stamp';
import { BIOMETRIC, type Biometric } from '@/features/auth';
import { Sen } from '@/features/sen';
import {
  type Revealed,
  RevealedAmounts,
  RollAmount,
  toRowView,
  useAmountView,
} from '@/features/transactions';
import { CATEGORY_LABEL } from '@/models/category';
import { signed } from '@/models/money';
import type { MaskedRow } from '@/models/transaction';
import { GLYPH_PASTELS } from '@/theme/colors';
import { FONT, type } from '@/theme/type';

import { addedText, heroCaption, receiptFacts, stampDate } from './receipt';

/** What the screen shows. A bad id, a missing row and a deleted row are all `missing`. */
export type DetailBody =
  | { readonly kind: 'loading' }
  | { readonly kind: 'missing' }
  | { readonly kind: 'failed' }
  | { readonly kind: 'found'; readonly row: MaskedRow };

export type DetailActions = {
  readonly onBack: () => void;
  readonly onLock: () => void;
  readonly onShow: () => void;
  readonly onHide: () => void;
  readonly onDelete: () => void;
  readonly onRetry: () => void;
};

export type DetailViewProps = {
  readonly body: DetailBody;
  readonly hidden: boolean;
  /** Null while hidden: the amount is never read then. */
  readonly revealed: Revealed | null;
  readonly biometric: Biometric;
  readonly actions: DetailActions;
};

export function DetailView({
  body,
  hidden,
  revealed,
  biometric,
  actions,
}: DetailViewProps): ReactNode {
  const found = body.kind === 'found';
  return (
    <RevealedAmounts value={revealed}>
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <Header
          shown={found && !hidden}
          onBack={actions.onBack}
          onLock={actions.onLock}
          onHide={actions.onHide}
        />
        {body.kind === 'loading' && <Loading />}
        {body.kind === 'missing' && <Missing onBack={actions.onBack} />}
        {body.kind === 'failed' && <Failed onRetry={actions.onRetry} onBack={actions.onBack} />}
        {body.kind === 'found' && (
          <>
            <Receipt row={body.row} hidden={hidden} biometric={biometric} onShow={actions.onShow} />
            <Footer row={body.row} biometric={biometric} onDelete={actions.onDelete} />
          </>
        )}
      </ScrollView>
    </RevealedAmounts>
  );
}

function Header({
  shown,
  onBack,
  onLock,
  onHide,
}: {
  readonly shown: boolean;
  readonly onBack: () => void;
  readonly onLock: () => void;
  readonly onHide: () => void;
}) {
  return (
    <View style={styles.header}>
      <Key icon="arrow-left" accessibilityLabel="Back to history" onPress={onBack} />
      <View style={styles.titleBox}>
        <Text accessibilityRole="header" style={styles.screenTitle}>
          Receipt
        </Text>
        <Text style={styles.screenSub}>RESIT</Text>
      </View>
      {shown ? (
        <Key
          tone="lemon"
          icon="eye-off-outline"
          accessibilityLabel="Hide amounts"
          onPress={onHide}
        />
      ) : (
        <Key icon="lock-outline" accessibilityLabel="Lock Sen now" onPress={onLock} />
      )}
    </View>
  );
}

function Receipt({
  row,
  hidden,
  biometric,
  onShow,
}: {
  readonly row: MaskedRow;
  readonly hidden: boolean;
  readonly biometric: Biometric;
  readonly onShow: () => void;
}) {
  const { theme } = useUnistyles();
  const amount = useAmountView(row.id);
  const value = amount === null ? null : signed(amount, row.type);
  const glyph = toRowView(row);
  const manual = row.source === 'manual';
  const sensor = BIOMETRIC[biometric];
  return (
    <View style={styles.receipt}>
      <View style={styles.peek}>
        <Sen
          pose={hidden ? 'masked' : 'revealed'}
          size={96}
          label={
            hidden
              ? 'Sen, eyes closed while amounts are hidden'
              : 'Sen, eyes open while amounts show'
          }
        />
      </View>
      <ReceiptSlip>
        <View style={styles.slip}>
          {manual ? (
            <View style={styles.stamp}>
              <Stamp
                caption="ADDED BY"
                word="You"
                date={stampDate(row.day)}
                accessibilityLabel="Stamp: added by you"
              />
            </View>
          ) : (
            row.status === 'pending' &&
            !hidden && (
              <View style={styles.stamp}>
                <Stamp caption="BELUM SELESAI" word="Pending" date={stampDate(row.day)} />
              </View>
            )
          )}
          <View style={styles.captions}>
            <Text
              style={styles.caption}
            >{`SEN · ${row.account.name} ·· ${row.account.last4}`}</Text>
            <Text style={styles.caption}>{manual ? 'MANUAL ENTRY' : 'BANK RECORD'}</Text>
          </View>
          <View style={styles.titleRow}>
            <View style={[styles.glyph, { backgroundColor: GLYPH_PASTELS[glyph.tone] }]}>
              <MaterialCommunityIcons name={glyph.icon} size={23} color={theme.colors.onPastel} />
            </View>
            <View style={styles.titleText}>
              <Text style={styles.title}>{row.description}</Text>
              <Text style={styles.muted}>{CATEGORY_LABEL[row.category]}</Text>
            </View>
          </View>
          <View style={styles.hero}>
            <RollAmount value={value} size="hero" direction={row.type} />
            <View style={styles.heroLine}>
              <MaterialCommunityIcons
                name={row.type === 'debit' ? 'arrow-top-right' : 'arrow-bottom-left'}
                size={13}
                color={theme.colors.inkMuted}
              />
              <Text style={styles.heroCaption}>{heroCaption(row)}</Text>
            </View>
          </View>
          {row.status === 'pending' && (
            <View style={styles.pending}>
              <MaterialCommunityIcons name="clock-outline" size={16} color={theme.colors.pending} />
              <Text style={styles.pendingText}>Pending</Text>
            </View>
          )}
          {hidden && (
            <View style={styles.show}>
              <Key
                tone="lemon"
                size="large"
                icon={sensor.icon}
                label="Show amounts"
                onPress={onShow}
              />
              <Text
                style={styles.note}
              >{`Asks for ${sensor.name} first. Stays shown until you hide it.`}</Text>
            </View>
          )}
          <Source row={row} />
          <View>
            <SlipRule />
            {receiptFacts(row).map((fact) => (
              <View key={fact.label} style={styles.fact}>
                <Text style={styles.factLabel}>{fact.label}</Text>
                <Leader />
                <Text style={styles.factValue(fact.tone === 'pending')}>{fact.text}</Text>
              </View>
            ))}
          </View>
          <View style={styles.total}>
            <Text style={styles.totalLabel}>TOTAL</Text>
            <Leader />
            <RollAmount value={value} size="net" sign="never" />
          </View>
          <View style={styles.reference}>
            <Text style={styles.factLabel}>REFERENCE</Text>
            <Text selectable style={styles.referenceCode}>
              {row.reference}
            </Text>
          </View>
          <Text style={styles.thanks}>* TERIMA KASIH · THANK YOU *</Text>
        </View>
      </ReceiptSlip>
    </View>
  );
}

function Source({ row }: { readonly row: MaskedRow }) {
  const { theme } = useUnistyles();
  const manual = row.source === 'manual';
  return (
    <View style={styles.source}>
      <View style={styles.sourceIcon(manual)}>
        <MaterialCommunityIcons
          name={manual ? 'cellphone-lock' : 'bank-outline'}
          size={19}
          color={theme.colors.onPastel}
        />
      </View>
      <View style={styles.sourceText}>
        <Text style={styles.factLabel}>SOURCE</Text>
        <Text style={styles.sourceTitle}>
          {manual ? addedText(row) : 'From your bank · read only'}
        </Text>
        <Text style={styles.sourceNote}>
          {manual
            ? 'Encrypted on this phone. No edits: delete it and add it again.'
            : `Bank rows come from ${row.account.name} and can’t be changed in Sen.`}
        </Text>
      </View>
    </View>
  );
}

function Footer({
  row,
  biometric,
  onDelete,
}: {
  readonly row: MaskedRow;
  readonly biometric: Biometric;
  readonly onDelete: () => void;
}) {
  if (row.source !== 'manual') return null;
  return (
    <View style={styles.footer}>
      <Key
        tone="danger"
        size="large"
        icon="delete-outline"
        label="Delete transaction"
        onPress={onDelete}
      />
      <Text style={styles.note}>
        {`Asks for ${BIOMETRIC[biometric].name} first. You can undo for 6 seconds after.`}
      </Text>
    </View>
  );
}

function Loading() {
  return (
    <View style={styles.receipt}>
      <ReceiptSlip>
        <View accessibilityLabel="Finding this receipt" style={styles.slip}>
          <Bone width="55%" height={10} />
          <View style={styles.titleRow}>
            <Bone width={48} height={48} radius={20} />
            <View style={styles.titleText}>
              <Bone width="70%" height={20} />
              <Bone width="40%" height={12} />
            </View>
          </View>
          <Bone width="80%" height={72} radius={12} />
          {[0, 1, 2, 3, 4].map((i) => (
            <View key={i} style={styles.boneFact}>
              <Bone width={80} height={11} />
              <Bone width={110} height={13} />
            </View>
          ))}
        </View>
      </ReceiptSlip>
      <Text accessibilityRole="text" style={styles.finding}>
        FINDING THIS RECEIPT…
      </Text>
    </View>
  );
}

function Missing({ onBack }: { readonly onBack: () => void }) {
  return (
    <View style={styles.receipt}>
      <ReceiptSlip>
        <View testID="detail-missing" style={styles.slip}>
          <Text style={styles.caption}>RECEIPT · NOT FOUND</Text>
          <Text accessibilityRole="header" style={styles.stateTitle}>
            {'This transaction isn’t here any more'}
          </Text>
          <Text style={styles.stateBody}>
            It may have been reversed or cleared since you opened it. Your history always has the
            latest list.
          </Text>
          <Key
            tone="lemon"
            size="large"
            icon="arrow-left"
            label="Back to history"
            onPress={onBack}
          />
        </View>
      </ReceiptSlip>
    </View>
  );
}

function Failed({
  onRetry,
  onBack,
}: {
  readonly onRetry: () => void;
  readonly onBack: () => void;
}) {
  const { theme } = useUnistyles();
  return (
    <View style={styles.receipt}>
      <ReceiptSlip>
        <View testID="detail-failed" style={styles.slip}>
          <View style={styles.heroLine}>
            <MaterialCommunityIcons
              name="alert-circle-outline"
              size={13}
              color={theme.colors.pending}
            />
            <Text style={styles.failedCaption}>{'COULDN’T READ IT'}</Text>
          </View>
          <Text accessibilityRole="header" style={styles.stateTitle}>
            {'Couldn’t load this receipt'}
          </Text>
          <Text style={styles.stateBody}>
            {
              'Sen couldn’t read it from this phone. Nothing in your account has changed. Try again.'
            }
          </Text>
          <Key tone="lemon" size="large" icon="refresh" label="Retry" onPress={onRetry} />
          <Pressable accessibilityRole="button" onPress={onBack} style={styles.link}>
            <Text style={styles.linkText}>Back to history</Text>
          </Pressable>
        </View>
      </ReceiptSlip>
    </View>
  );
}

const styles = StyleSheet.create((theme, rt) => ({
  screen: { flex: 1, backgroundColor: theme.colors.canvas },
  content: {
    flexGrow: 1,
    gap: 16,
    paddingTop: rt.insets.top + 18,
    paddingHorizontal: 20,
    paddingBottom: rt.insets.bottom + 28,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 2,
  },
  titleBox: { alignItems: 'center', gap: 2 },
  screenTitle: { ...type.words(26), lineHeight: 26, color: theme.colors.ink },
  screenSub: { ...type.mono(10, 600), letterSpacing: 1.6, color: theme.colors.inkMuted },
  receipt: { marginTop: 54 },
  peek: { position: 'absolute', left: 22, top: -62 },
  slip: { paddingTop: 14, paddingHorizontal: 20, paddingBottom: 18, gap: 16 },
  stamp: { position: 'absolute', right: 12, top: -50, zIndex: 2 },
  captions: { gap: 3, paddingRight: 104 },
  caption: { ...type.caption(10), color: theme.colors.inkMuted },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  glyph: {
    width: 48,
    height: 48,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleText: { flex: 1, gap: 2 },
  title: { fontFamily: FONT.numerals, fontSize: 22, lineHeight: 24, color: theme.colors.ink },
  muted: { fontSize: 13, color: theme.colors.inkMuted },
  hero: { gap: 10 },
  heroLine: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  heroCaption: { ...type.mono(11), letterSpacing: 0.66, color: theme.colors.inkMuted },
  pending: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 30,
    paddingLeft: 9,
    paddingRight: 12,
    borderRadius: 15,
    borderWidth: 1.5,
    borderColor: theme.colors.pending,
  },
  pendingText: { fontSize: 13, fontWeight: '700', color: theme.colors.pending },
  show: { gap: 8 },
  note: { fontSize: 13, lineHeight: 18, textAlign: 'center', color: theme.colors.inkMuted },
  source: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: theme.colors.canvas,
  },
  sourceIcon: (manual: boolean) => ({
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: manual ? theme.colors.lilac : theme.colors.chip,
  }),
  sourceText: { flex: 1, gap: 3 },
  sourceTitle: { fontSize: 15, fontWeight: '700', color: theme.colors.ink },
  sourceNote: { fontSize: 13, lineHeight: 18, color: theme.colors.inkMuted },
  fact: { flexDirection: 'row', alignItems: 'flex-end', paddingTop: 11 },
  factLabel: { ...type.mono(11), letterSpacing: 0.88, color: theme.colors.inkMuted },
  factValue: (pending: boolean) => ({
    flexShrink: 1,
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'right',
    color: pending ? theme.colors.pending : theme.colors.ink,
  }),
  total: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderTopWidth: 3,
    borderBottomWidth: 3,
    borderColor: theme.colors.ink,
  },
  totalLabel: { ...type.mono(13, 600), letterSpacing: 1.3, color: theme.colors.ink },
  reference: { gap: 4 },
  referenceCode: { ...type.mono(16, 600), letterSpacing: 0.48, color: theme.colors.ink },
  thanks: {
    ...type.mono(11),
    letterSpacing: 1.76,
    textAlign: 'center',
    color: theme.colors.inkMuted,
  },
  footer: { gap: 6 },
  boneFact: { flexDirection: 'row', justifyContent: 'space-between' },
  finding: {
    ...type.caption(11),
    marginTop: 12,
    textAlign: 'center',
    color: theme.colors.inkMuted,
  },
  stateTitle: { ...type.words(48), lineHeight: 46, color: theme.colors.ink },
  stateBody: { fontSize: 15, lineHeight: 21, color: theme.colors.inkMuted },
  failedCaption: { ...type.caption(10), color: theme.colors.pending },
  link: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  linkText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.inkMuted,
    textDecorationLine: 'underline',
  },
}));
