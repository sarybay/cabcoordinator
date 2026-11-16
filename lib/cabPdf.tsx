import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer'

const DARK  = '#1A1A1A'
const GRAY  = '#6B7280'
const GREEN = '#166534'
const BLUE  = '#1E40AF'
const BDR   = '#1A1A1A'

const s = StyleSheet.create({
  page: { fontFamily: 'Helvetica', padding: 36, fontSize: 10, color: DARK, backgroundColor: '#FFFFFF' },

  datestamp: { fontSize: 8, color: BLUE, marginBottom: 6 },

  header: { flexDirection: 'row', marginBottom: 18 },
  logoBox: {
    width: '45%',
    borderWidth: 1, borderColor: BDR, borderStyle: 'solid',
    padding: 14, justifyContent: 'center', alignItems: 'center',
  },
  orgNameLarge:  { fontSize: 18, fontFamily: 'Helvetica-Bold', textAlign: 'center', marginBottom: 3 },
  orgSubtitle:   { fontSize: 8, color: GRAY, textAlign: 'center' },
  headerRight:   { flex: 1, paddingLeft: 14, justifyContent: 'flex-end', alignItems: 'flex-end' },
  resDetail:     { fontSize: 9, color: GRAY, marginBottom: 8 },
  headerOrgName: { fontSize: 11, fontFamily: 'Helvetica-Bold', marginBottom: 2 },
  headerPhone:   { fontSize: 13, fontFamily: 'Helvetica-Bold', color: GREEN },
  headerDate:    { fontSize: 8, color: BLUE, marginTop: 4 },

  section:    { marginBottom: 10, borderWidth: 1, borderColor: BDR, borderStyle: 'solid' },
  row:        { flexDirection: 'row' },
  rowDivider: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: BDR, borderTopStyle: 'solid' },

  lbl: { width: '32%', paddingVertical: 6, paddingHorizontal: 8, fontFamily: 'Helvetica-Bold', fontSize: 9 },
  val: {
    flex: 1, paddingVertical: 6, paddingHorizontal: 8, fontSize: 9,
    backgroundColor: '#FFFFFF',
    borderLeftWidth: 1, borderLeftColor: BDR, borderLeftStyle: 'solid',
  },
  valWhite: {
    flex: 1, paddingVertical: 6, paddingHorizontal: 8, fontSize: 9,
    backgroundColor: '#FFFFFF', minHeight: 40,
    borderLeftWidth: 1, borderLeftColor: BDR, borderLeftStyle: 'solid',
  },

  commentTitle:     { fontSize: 9, fontFamily: 'Helvetica-Bold', marginTop: 14, marginBottom: 5 },
  commentPara:      { fontSize: 8, marginBottom: 4 },
  commentParaBold:  { fontSize: 8, fontFamily: 'Helvetica-Bold', marginBottom: 4 },

  footer:      { alignItems: 'flex-end', marginTop: 16 },
  footerBold:  { fontSize: 8, fontFamily: 'Helvetica-Bold', textAlign: 'right' },
  footerNorm:  { fontSize: 8, textAlign: 'right' },
})

type RowProps = { label: string; value: string; first?: boolean; white?: boolean }
function Row({ label, value, first, white }: RowProps) {
  return (
    <View style={first ? s.row : s.rowDivider}>
      <Text style={s.lbl}>{label}</Text>
      <Text style={white ? s.valWhite : s.val}>{value}</Text>
    </View>
  )
}

export type CabPdfPassenger = {
  name: string | null
  phone: string | null
  flightNumber: string | null
  origin: string | null
  destination: string | null
  arrivalDate: string | null
  arrivalTime: string | null
  additionalDetails: string | null
}

export type CabPdfProps = {
  orgName: string
  coordinatorPhone: string | null
  passengers: CabPdfPassenger[]
  cabLabel: string
  cabPrice: number | null
  generatedAt: string
}

function fmtDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export function CabPdf({ orgName, coordinatorPhone, passengers, cabLabel, cabPrice, generatedAt }: CabPdfProps) {
  const names  = passengers.map(p => p.name).filter(Boolean).join(', ') || '—'
  const phones = passengers.map(p => p.phone).filter(Boolean).join(', ') || '—'
  const origin = passengers.find(p => p.origin)?.origin ?? '—'
  const dest   = passengers.find(p => p.destination)?.destination ?? '—'
  const flights = passengers.map(p => p.flightNumber).filter(Boolean).join(', ') || '—'
  const firstDate = passengers.find(p => p.arrivalDate)?.arrivalDate ?? null
  const firstTime = passengers.find(p => p.arrivalTime)?.arrivalTime ?? null
  const accommodation = passengers.find(p => p.additionalDetails)?.additionalDetails ?? passengers.find(p => p.destination)?.destination ?? '—'

  const price    = cabPrice != null ? `€${cabPrice}` : '—'
  const paxCount = String(passengers.length)
  const phone    = coordinatorPhone ?? ''

  const msgLines = passengers
    .map(p => p.additionalDetails)
    .filter(Boolean)
    .join('\n') || '—'

  return (
    <Document title={`${cabLabel} – Driver Sheet`}>
      <Page size="A4" style={s.page}>

        {/* Top-left date stamp */}
        <Text style={s.datestamp}>{generatedAt}</Text>

        {/* Header */}
        <View style={s.header}>
          <View style={s.logoBox}>
            <Text style={s.orgNameLarge}>{orgName}</Text>
            <Text style={s.orgSubtitle}>{cabLabel}</Text>
          </View>
          <View style={s.headerRight}>
            <Text style={s.resDetail}>Reservation Detail</Text>
            <Text style={s.headerOrgName}>{orgName}</Text>
            {phone ? <Text style={s.headerPhone}>{phone}</Text> : null}
            <Text style={s.headerDate}>{generatedAt}</Text>
          </View>
        </View>

        {/* Section 1 — Customer */}
        <View style={s.section}>
          <Row label="Name Surname:" value={names}  first />
          <Row label="E-Mail:"       value="" />
          <Row label="Mobil:"        value={phones} />
        </View>

        {/* Section 2 — Trip */}
        <View style={s.section}>
          <Row label="From:"         value={origin}   first />
          <Row label="To:"           value={dest} />
          <Row label="Passanger:"    value={paxCount} />
          <Row label="Total Price:"  value={price} />
        </View>

        {/* Section 3 — Flight */}
        <View style={s.section}>
          <Row label="Arrival Date:"       value={fmtDate(firstDate)} first />
          <Row label="Arrival Time:"       value={firstTime ? firstTime.slice(0, 5) : '—'} />
          <Row label="Flight Number:"      value={flights} />
          <Row label="Accommodation Name:" value={accommodation} />
        </View>

        {/* Section 4 — Message */}
        <View style={s.section}>
          <Row label="Message:" value={msgLines} first white />
        </View>

        {/* Transfer Comment */}
        <Text style={s.commentTitle}>Transfer Comment</Text>
        <Text style={s.commentPara}>
          Thank you for reservation. Your transfer is CONFIRMED
        </Text>
        <Text style={s.commentPara}>
          Meeting point: Please make sure you write down your WhatsApp phone number correctly, as we will send you the airport meeting details via WhatsApp, including pictures and videos.
        </Text>
        {phone ? (
          <Text style={s.commentParaBold}>
            Important: We will be waiting for you at the meeting point. If you can not see your welcome sign, contact our coordinator: {phone}
          </Text>
        ) : (
          <Text style={s.commentParaBold}>
            Important: We will be waiting for you at the meeting point.
          </Text>
        )}
        <Text style={s.commentPara}>
          Payment: You can pay cash to the driver after the trip. (Euro or Dollar or Lira)
        </Text>
        <Text style={s.commentParaBold}>
          Note: We accept card payments; however, if you pay by card, the bank charges an additional €5 commission for each way. We always recommend paying in cash.
        </Text>
        <Text style={s.commentPara}>
          You can contact us 7/24. We will wish you a good trip.
        </Text>

        {/* Footer */}
        {phone ? (
          <View style={s.footer}>
            <Text style={s.footerBold}>Call our Customer Service Center 24/7 :</Text>
            <Text style={s.footerNorm}>Customer Support : {phone}</Text>
            <Text style={s.footerNorm}>( Call &amp; Whatsapp )</Text>
          </View>
        ) : null}

      </Page>
    </Document>
  )
}
