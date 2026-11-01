# Corpus evaluation

Documents: 176 · readings: 500

## invoice

| source | n | type | vendor | date | currency | total | vat | items | no false alarm | number | due | subtotal | all fields |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| pdf | 83 | 100% | 100% | 100% | 100% | 100% | 100% | 100% | 100% | 100% | 100% | 100% | 100% |
| image | 79 | 100% | 97% | 97% | 95% | 100% | 96% | 94% | 92% | 99% | 100% | 100% | 81% |
| photo | 27 | 100% | 100% | 100% | 96% | 100% | 96% | 93% | 93% | 96% | 100% | 100% | 89% |
| office | 51 | 100% | 100% | 100% | 100% | 100% | 100% | 100% | 100% | 100% | 100% | 100% | 100% |
| conditions | 102 | 93% | 87% | 88% | 95% | 85% | 80% | 77% | 75% | 80% | 86% | 79% | 64% |

## receipt

| source | n | type | vendor | date | currency | total | vat | items | no false alarm | all fields |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| pdf | 10 | 100% | 100% | 100% | 100% | 100% | 100% | 100% | 100% | 100% |
| image | 10 | 100% | 100% | 100% | 100% | 100% | 90% | 90% | 80% | 80% |
| photo | 10 | 100% | 100% | 100% | 100% | 100% | 100% | 100% | 100% | 100% |
| conditions | 51 | 90% | 90% | 84% | 92% | 92% | 86% | 84% | 82% | 76% |

## statement

| source | n | type | transaction count | amounts | dates | no false alarm | all fields |
| --- | --- | --- | --- | --- | --- | --- | --- |
| pdf | 16 | 100% | 100% | 100% | 100% | 100% | 100% |
| image | 16 | 100% | 100% | 94% | 100% | 94% | 94% |
| photo | 6 | 100% | 83% | 83% | 83% | 83% | 83% |
| conditions | 17 | 94% | 82% | 71% | 76% | 76% | 65% |

## report

| source | n | type | tables | net profit | checks | all fields |
| --- | --- | --- | --- | --- | --- | --- |
| pdf | 10 | 100% | 100% | 100% | 100% | 100% |

## reject

| source | n | type | all fields |
| --- | --- | --- | --- |
| pdf | 6 | 100% | 100% |
| image | 6 | 100% | 100% |

## Phone photo conditions

Invoices, receipts and a bank statement, each photographed under every condition.

| condition | n | all fields | total | date | vendor / transactions |
| --- | --- | --- | --- | --- | --- |
| dark | 10 | 100% | 100% | 100% | 100% |
| overexposed | 10 | 90% | 100% | 100% | 90% |
| flash | 10 | 30% | 60% | 100% | 90% |
| blur | 10 | 0% | 50% | 40% | 80% |
| shake | 10 | 0% | 0% | 0% | 20% |
| low-res | 10 | 30% | 90% | 50% | 80% |
| whatsapp | 10 | 80% | 100% | 90% | 100% |
| perspective | 10 | 90% | 100% | 100% | 100% |
| curled | 10 | 90% | 100% | 100% | 90% |
| upside-down | 10 | 90% | 100% | 100% | 90% |
| sideways | 10 | 80% | 100% | 100% | 90% |
| warm-light | 10 | 90% | 100% | 100% | 100% |
| hand-shadow | 10 | 30% | 70% | 80% | 80% |
| far-away | 10 | 80% | 90% | 100% | 100% |
| close-up | 10 | 90% | 100% | 100% | 100% |
| shadow-fill | 10 | 90% | 100% | 100% | 90% |
| screenshot | 10 | 90% | 100% | 100% | 90% |

## Failures

- **inv-en-US-classic** (image): date
  - date: got `"2026-02-18"`, want `"2026-02-13"`
- **inv-en-US-classic** (cond:flash): number
  - number: got `null`, want `"INV-2026-6610"`
- **inv-en-US-classic** (cond:blur): date, items, no false alarm, number
  - vendor: got `"Harbor& Finch Supply Co."`, want `"Harbor & Finch Supply Co."`
  - number: got `null`, want `"INV-2026-6610"`
  - date: got `"2026-02-27"`, want `"2026-02-13"`
  - items: got `[0,18,120,4500,6225,125000,831200]`, want `[18,45,54,120,600,1250,6225]`
  - failed checks: Line items add up; VAT matches its rate; Quantity × price per line
- **inv-en-US-classic** (cond:shake): type, vendor, date, currency, total, vat, items, no false alarm, number, due, subtotal
  - vendor: got `"Harbor & Finch Co. NVOICE"`, want `"Harbor & Finch Supply Co."`
  - number: got `null`, want `"INV-2026-6610"`
  - date: got `null`, want `"2026-02-13"`
  - due: got `null`, want `"2026-02-27"`
  - currency: got `"GBP"`, want `"USD"`
  - subtotal: got `null`, want `8312`
  - total: got `null`, want `9049.69`
  - vat: got `[]`, want `[737.69]`
  - items: got `[]`, want `[18,45,54,120,600,1250,6225]`
  - failed checks: Required fields
- **inv-en-US-classic** (cond:low-res): date, vat, items, no false alarm, number, due
  - number: got `null`, want `"INV-2026-6610"`
  - date: got `null`, want `"2026-02-13"`
  - due: got `null`, want `"2026-02-27"`
  - vat: got `[737.88,7107]`, want `[737.69]`
  - items: got `[2272026]`, want `[18,45,54,120,600,1250,6225]`
  - failed checks: Required fields; Line items add up; Subtotal + VAT = total
- **inv-en-US-classic** (cond:sideways): number
  - number: got `null`, want `"INV-2026-6610"`
- **inv-en-US-classic** (cond:hand-shadow): total, no false alarm, subtotal
  - subtotal: got `null`, want `8312`
  - total: got `null`, want `9049.69`
  - failed checks: Required fields
- **inv-tr-discount** (image): vendor
  - vendor: got `"Kuzeyriizgan Danışmanlık A.Ş."`, want `"Kuzeyrüzgarı Danışmanlık A.Ş."`
- **inv-tr-discount** (cond:overexposed): vendor
  - vendor: got `"Kuzeyriizgan Danışmanlık A.Ş."`, want `"Kuzeyrüzgarı Danışmanlık A.Ş."`
- **inv-tr-discount** (cond:flash): vendor, total, vat, items, no false alarm, subtotal
  - vendor: got `"Kuzeyriizgan Danışmanlık A.Ş."`, want `"Kuzeyrüzgarı Danışmanlık A.Ş."`
  - subtotal: got `null`, want `5404.24`
  - total: got `null`, want `6485.09`
  - vat: got `[180.85]`, want `[1080.85]`
  - items: got `[-283.64,15,104.24,180,225,1079.88,1200,2988]`, want `[-283.64,15,180,225,1079.88,1200,2988]`
  - failed checks: Required fields; Quantity × price per line
- **inv-tr-discount** (cond:blur): vendor, date, total, vat, items, no false alarm, number, subtotal
  - vendor: got `"Kuzeyriizgan Danışmanlık A.Ş."`, want `"Kuzeyrüzgarı Danışmanlık A.Ş."`
  - number: got `"F2020053808"`, want `"F2026053898"`
  - date: got `"2026-08-17"`, want `"2026-07-18"`
  - subtotal: got `540424`, want `5404.24`
  - total: got `6.485`, want `6485.09`
  - vat: got `[1.08085]`, want `[1080.85]`
  - items: got `[1.2,15,180,225,2026,2988,28364,107988]`, want `[-283.64,15,180,225,1079.88,1200,2988]`
  - failed checks: Line items add up; Subtotal + VAT = total; Quantity × price per line
- **inv-tr-discount** (cond:shake): type, vendor, date, currency, total, vat, items, no false alarm, number, due, subtotal
  - vendor: got `"Kuzeyrizgan DamesmaniikAS."`, want `"Kuzeyrüzgarı Danışmanlık A.Ş."`
  - number: got `null`, want `"F2026053898"`
  - date: got `null`, want `"2026-07-18"`
  - due: got `null`, want `"2026-08-17"`
  - currency: got `null`, want `"TRY"`
  - subtotal: got `null`, want `5404.24`
  - total: got `null`, want `6485.09`
  - vat: got `[]`, want `[1080.85]`
  - items: got `[]`, want `[-283.64,15,180,225,1079.88,1200,2988]`
  - failed checks: Required fields
- **inv-tr-discount** (cond:low-res): vendor, date, vat, items, no false alarm, number, subtotal
  - vendor: got `"Kuzeyriizgan Danışmanlık A.Ş."`, want `"Kuzeyrüzgarı Danışmanlık A.Ş."`
  - number: got `null`, want `"F2026053898"`
  - date: got `"2026-08-17"`, want `"2026-07-18"`
  - subtotal: got `540424`, want `5404.24`
  - vat: got `[]`, want `[1080.85]`
  - items: got `[-283.64,15,180,225,1079.88,1200,288800]`, want `[-283.64,15,180,225,1079.88,1200,2988]`
  - failed checks: Line items add up; Subtotal + VAT = total; Quantity × price per line
- **inv-tr-discount** (cond:curled): vendor
  - vendor: got `"Kuzeyriizgan Danışmanlık A.Ş."`, want `"Kuzeyrüzgarı Danışmanlık A.Ş."`
- **inv-tr-discount** (cond:upside-down): vendor
  - vendor: got `"Kuzeyriizgan Danışmanlık A.Ş."`, want `"Kuzeyrüzgarı Danışmanlık A.Ş."`
- **inv-tr-discount** (cond:sideways): vendor
  - vendor: got `"Kuzeyriizgan Danışmanlık A.Ş."`, want `"Kuzeyrüzgarı Danışmanlık A.Ş."`
- **inv-tr-discount** (cond:shadow-fill): vendor
  - vendor: got `"Kuzeyriizgan Danışmanlık A.Ş."`, want `"Kuzeyrüzgarı Danışmanlık A.Ş."`
- **inv-tr-discount** (cond:screenshot): vendor
  - vendor: got `"Kuzeyriizgan Danışmanlık A.Ş."`, want `"Kuzeyrüzgarı Danışmanlık A.Ş."`
- **inv-de-multi-vat** (cond:flash): items, no false alarm
  - items: got `[90,225,600,899.9,1079.88,12500,15394.78]`, want `[90,225,600,899.9,1079.88,12500]`
  - failed checks: Line items add up
- **inv-de-multi-vat** (cond:blur): total, vat, no false alarm, number, due, subtotal
  - number: got `null`, want `"INV-2026-75819"`
  - due: got `null`, want `"2026-08-10"`
  - subtotal: got `15.39478`, want `15394.78`
  - total: got `18.08221`, want `18082.21`
  - vat: got `[13858,254885,179686394]`, want `[138.58,2548.85]`
  - failed checks: Line items add up; Subtotal + VAT = total
- **inv-de-multi-vat** (cond:shake): type, vendor, date, currency, total, vat, items, no false alarm, number, due, subtotal
  - vendor: got `"Alpenblick Druck GenibH BECHNUNG"`, want `"Alpenblick Druck GmbH"`
  - number: got `null`, want `"INV-2026-75819"`
  - date: got `null`, want `"2026-07-11"`
  - due: got `null`, want `"2026-08-10"`
  - currency: got `"USD"`, want `"EUR"`
  - subtotal: got `null`, want `15394.78`
  - total: got `null`, want `18082.21`
  - vat: got `[]`, want `[138.58,2548.85]`
  - items: got `[]`, want `[90,225,600,899.9,1079.88,12500]`
  - failed checks: Required fields
- **inv-de-multi-vat** (cond:low-res): type, vat, items, no false alarm, number, due, subtotal
  - number: got `null`, want `"INV-2026-75819"`
  - due: got `null`, want `"2026-08-10"`
  - subtotal: got `-129923196.79`, want `15394.78`
  - vat: got `[254885,129686394]`, want `[138.58,2548.85]`
  - items: got `[2026]`, want `[90,225,600,899.9,1079.88,12500]`
  - failed checks: Line items add up; VAT matches its rate
- **inv-de-multi-vat** (cond:hand-shadow): vat, items, no false alarm, due, subtotal
  - due: got `null`, want `"2026-08-10"`
  - subtotal: got `17943.63`, want `15394.78`
  - vat: got `[138.58]`, want `[138.58,2548.85]`
  - items: got `[90,225,600,899.9,1079.88,12500,15394.78]`, want `[90,225,600,899.9,1079.88,12500]`
  - failed checks: Line items add up; VAT matches its rate; Quantity × price per line
- **inv-de-multi-vat** (cond:far-away): due
  - due: got `null`, want `"2026-08-10"`
- **inv-fr-modern** (cond:flash): total, vat, items, no false alarm, subtotal
  - subtotal: got `null`, want `2319.73`
  - total: got `null`, want `2783.68`
  - vat: got `[]`, want `[463.95]`
  - items: got `[0,12.9,64.5,112.5,179.98,269.97,600,1079.88]`, want `[12.9,64.5,112.5,179.98,269.97,600,1079.88]`
  - failed checks: Required fields
- **inv-fr-modern** (cond:blur): items, no false alarm
  - vendor: got `"Boulangerie Lefévre SAS"`, want `"Boulangerie Lefèvre SAS"`
  - items: got `[12.9,112.5,6450,17998,20097,60000,107988]`, want `[12.9,64.5,112.5,179.98,269.97,600,1079.88]`
  - failed checks: Line items add up; Quantity × price per line
- **inv-fr-modern** (cond:shake): type, date, total, vat, items, no false alarm, number, due, subtotal
  - number: got `null`, want `"RE-03753"`
  - date: got `null`, want `"2026-07-04"`
  - due: got `null`, want `"2026-07-18"`
  - subtotal: got `null`, want `2319.73`
  - total: got `null`, want `2783.68`
  - vat: got `[]`, want `[463.95]`
  - items: got `[1235,11259]`, want `[12.9,64.5,112.5,179.98,269.97,600,1079.88]`
  - failed checks: Required fields
- **inv-fr-modern** (cond:low-res): date, vat, items, no false alarm, subtotal
  - vendor: got `"Boulangerie Lefévre SAS"`, want `"Boulangerie Lefèvre SAS"`
  - date: got `"2026-07-18"`, want `"2026-07-04"`
  - subtotal: got `201973`, want `2319.73`
  - vat: got `[46195]`, want `[463.95]`
  - items: got `[12.9,269.97,600,1250,6450,17998,107088]`, want `[12.9,64.5,112.5,179.98,269.97,600,1079.88]`
  - failed checks: Line items add up; Subtotal + VAT = total; VAT matches its rate; Quantity × price per line
- **inv-fr-modern** (cond:warm-light): number
  - number: got `null`, want `"RE-03753"`
- **inv-fr-modern** (cond:hand-shadow): total, vat, items, no false alarm, subtotal
  - subtotal: got `null`, want `2319.73`
  - total: got `null`, want `2783.68`
  - vat: got `[]`, want `[463.95]`
  - items: got `[12.9,64.5,112.5,179.98,269.97,463.95,600,1079.88,2319.73,2783.68]`, want `[12.9,64.5,112.5,179.98,269.97,600,1079.88]`
  - failed checks: Required fields
- **inv-fr-modern** (cond:close-up): number
  - number: got `null`, want `"RE-03753"`
- **inv-fr-multi-vat** (image): date
  - date: got `"2026-02-28"`, want `"2026-02-23"`
- **inv-es-classic** (image): vat, no false alarm
  - vat: got `[]`, want `[51.41]`
  - failed checks: Subtotal + VAT = total
- **inv-es-multi-vat** (image): vat, no false alarm
  - vat: got `[1634]`, want `[603.87,1634]`
  - failed checks: Subtotal + VAT = total; VAT matches its rate
- **inv-pl-classic** (cond:blur): currency, total, items, no false alarm, number, due, subtotal
  - vendor: got `"Drukarnia Wisniewski S.A."`, want `"Drukarnia Wiśniewski S.A."`
  - number: got `null`, want `"FV/54149/07/2026"`
  - due: got `null`, want `"2026-08-18"`
  - currency: got `null`, want `"PLN"`
  - subtotal: got `130680`, want `1343.68`
  - total: got `1652`, want `1652.73`
  - items: got `[179.98,1125,3870]`, want `[38.7,179.98,1125]`
  - failed checks: Line items add up; Subtotal + VAT = total; VAT matches its rate; Quantity × price per line
- **inv-pl-classic** (cond:shake): type, date, currency, total, vat, items, no false alarm, number, due, subtotal
  - vendor: got `"Drukarmiz Wiśniewski SA."`, want `"Drukarnia Wiśniewski S.A."`
  - number: got `null`, want `"FV/54149/07/2026"`
  - date: got `null`, want `"2026-07-19"`
  - due: got `null`, want `"2026-08-18"`
  - currency: got `null`, want `"PLN"`
  - subtotal: got `null`, want `1343.68`
  - total: got `null`, want `1652.73`
  - vat: got `[]`, want `[309.05]`
  - items: got `[]`, want `[38.7,179.98,1125]`
  - failed checks: Required fields
- **inv-pl-classic** (cond:low-res): items, no false alarm, number, subtotal
  - vendor: got `"Drukarnia Wisniewski S.A."`, want `"Drukarnia Wiśniewski S.A."`
  - number: got `null`, want `"FV/54149/07/2026"`
  - subtotal: got `134368`, want `1343.68`
  - vat: got `[309.06]`, want `[309.05]`
  - items: got `[38.7,179.08,1125]`, want `[38.7,179.98,1125]`
  - failed checks: Line items add up; Subtotal + VAT = total; VAT matches its rate; Quantity × price per line
- **inv-pl-classic** (cond:hand-shadow): total, vat
  - total: got `1343.68`, want `1652.73`
  - vat: got `[]`, want `[309.05]`
- **inv-en-IN-classic** (image): currency
  - currency: got `null`, want `"INR"`
- **inv-en-IN-modern** (image): currency
  - currency: got `null`, want `"INR"`
- **inv-en-IN-modern** (photo): currency, number
  - number: got `"2026/9388"`, want `"2026/99388"`
  - currency: got `null`, want `"INR"`
- **inv-en-IN-multi-vat** (image): currency, vat, no false alarm, number
  - number: got `null`, want `"INV-2026-31631"`
  - currency: got `null`, want `"INR"`
  - vat: got `[710.8,31142.91]`, want `[10.8,1142.91]`
  - failed checks: Subtotal + VAT = total
- **inv-en-IN-discount** (image): currency
  - currency: got `null`, want `"INR"`
- **inv-en-GB-leaders** (image): items
  - items: got `[89.99,450,1125,1290,31250]`, want `[89.99,90,450,1125,1200,31250]`
- **inv-tr-leaders** (image): items, no false alarm
  - vendor: got `"Ege Kirtasiye Ltd. Sti."`, want `"Ege Kırtasiye Ltd. Şti."`
  - items: got `[22.5,94,120,216,249,322.5]`, want `[22.5,54,120,216,249,322.5,747]`
  - failed checks: Line items add up
- **inv-es-leaders** (image): items, no false alarm
  - items: got `[49,89.99,180,498]`, want `[45,89.99,180,498]`
  - failed checks: Line items add up
- **inv-es-leaders** (photo): items, no false alarm
  - vendor: got `"Graficas Romero S.L."`, want `"Gráficas Romero S.L."`
  - items: got `[49,180,498]`, want `[45,89.99,180,498]`
  - failed checks: Line items add up
- **inv-es-leaders** (cond:flash): total, vat, items, no false alarm, subtotal
  - subtotal: got `null`, want `812.99`
  - total: got `null`, want `983.72`
  - vat: got `[]`, want `[170.73]`
  - items: got `[0,45,89.99,180,498,812.99,983.72]`, want `[45,89.99,180,498]`
  - failed checks: Required fields
- **inv-es-leaders** (cond:blur): vat, items, no false alarm, number, due, subtotal
  - number: got `"F2026043608"`, want `"F2026043698"`
  - due: got `null`, want `"2026-07-24"`
  - subtotal: got `null`, want `812.99`
  - vat: got `[]`, want `[170.73]`
  - items: got `[29,170.73,180,498,4500,581290]`, want `[45,89.99,180,498]`
  - failed checks: Line items add up
- **inv-es-leaders** (cond:shake): type, vendor, date, total, vat, items, no false alarm, number, due, subtotal
  - vendor: got `"DT Ere See Mia Ene"`, want `"Gráficas Romero S.L."`
  - number: got `null`, want `"F2026043698"`
  - date: got `null`, want `"2026-06-09"`
  - due: got `null`, want `"2026-07-24"`
  - subtotal: got `null`, want `812.99`
  - total: got `null`, want `983.72`
  - vat: got `[]`, want `[170.73]`
  - items: got `[24072076]`, want `[45,89.99,180,498]`
  - failed checks: Required fields
- **inv-es-leaders** (cond:low-res): date, vat, items, no false alarm, number, due, subtotal
  - number: got `"F20"`, want `"F2026043698"`
  - date: got `"2026-08-09"`, want `"2026-06-09"`
  - due: got `null`, want `"2026-07-24"`
  - subtotal: got `812.93`, want `812.99`
  - vat: got `[170.79]`, want `[170.73]`
  - items: got `[498,4500,8999,18000]`, want `[45,89.99,180,498]`
  - failed checks: Line items add up
- **inv-it-leaders** (image): items
  - items: got `[0,36,45,6825]`, want `[36,45,600,6225]`
- **inv-it-leaders** (photo): vat, items, no false alarm
  - vat: got `[306497550]`, want `[1519.32]`
  - items: got `[]`, want `[36,45,600,6225]`
  - failed checks: Subtotal + VAT = total
- **inv-pt-leaders** (image): items, no false alarm
  - items: got `[12.9,89.99,179.98,600,1079.88,32190]`, want `[12.9,89.99,179.98,600,1079.88,3750]`
  - failed checks: Line items add up
- **inv-pl-credit** (image): vendor
  - vendor: got `"Kowalski Hurtownia Sp. z 0.0. KORYGUJACA"`, want `"Kowalski Hurtownia Sp. z o.o."`
- **rcp-en-GB** (cond:blur): date, vat, items, no false alarm
  - vendor: got `"NORTRGATE ANALYTICSLIC"`, want `"NORTHGATE ANALYTICS LLC"`
  - number: got `"914"`, want `undefined`
  - date: got `null`, want `"2026-03-17"`
  - due: got `null`, want `undefined`
  - subtotal: got `null`, want `undefined`
  - vat: got `[]`, want `[3.4]`
  - items: got `[]`, want `[5.5,9.9,28,28]`
  - failed checks: Required fields
- **rcp-en-GB** (cond:shake): type, vendor, date, currency, total, vat, items, no false alarm
  - vendor: got `"sTs=sTs secs IST"`, want `"NORTHGATE ANALYTICS LLC"`
  - number: got `null`, want `undefined`
  - date: got `null`, want `"2026-03-17"`
  - due: got `null`, want `undefined`
  - currency: got `null`, want `"GBP"`
  - subtotal: got `null`, want `undefined`
  - total: got `null`, want `71.4`
  - vat: got `[]`, want `[3.4]`
  - items: got `[]`, want `[5.5,9.9,28,28]`
  - failed checks: Required fields
- **rcp-en-GB** (cond:hand-shadow): date, no false alarm
  - vendor: got `"NORTHGATE \\LYTICS LLC"`, want `"NORTHGATE ANALYTICS LLC"`
  - number: got `null`, want `undefined`
  - date: got `null`, want `"2026-03-17"`
  - due: got `null`, want `undefined`
  - subtotal: got `68`, want `undefined`
  - failed checks: Required fields
- **rcp-tr** (cond:blur): type, date, vat, items, no false alarm
  - vendor: got `"MANMARA YAZILIM A §"`, want `"MARMARA YAZILIM A.Ş."`
  - number: got `null`, want `undefined`
  - date: got `null`, want `"2026-04-09"`
  - due: got `null`, want `undefined`
  - subtotal: got `null`, want `undefined`
  - vat: got `[]`, want `[0.93]`
  - items: got `[]`, want `[14,14,16.5,19.8,29.7]`
  - failed checks: Required fields
- **rcp-tr** (cond:shake): type, vendor, date, currency, total, vat, items, no false alarm
  - vendor: got `"SBSNESS. ITUTw 3 FT"`, want `"MARMARA YAZILIM A.Ş."`
  - number: got `null`, want `undefined`
  - date: got `null`, want `"2026-04-09"`
  - due: got `null`, want `undefined`
  - currency: got `null`, want `"TRY"`
  - subtotal: got `null`, want `undefined`
  - total: got `null`, want `94`
  - vat: got `[]`, want `[0.93]`
  - items: got `[]`, want `[14,14,16.5,19.8,29.7]`
  - failed checks: Required fields
- **rcp-tr** (cond:hand-shadow): vendor
  - vendor: got `"MARMARA YAZI A.Ş."`, want `"MARMARA YAZILIM A.Ş."`
  - number: got `null`, want `undefined`
  - due: got `null`, want `undefined`
  - subtotal: got `93.07`, want `undefined`
- **rcp-de** (cond:flash): vat
  - number: got `null`, want `undefined`
  - due: got `null`, want `undefined`
  - subtotal: got `null`, want `undefined`
  - vat: got `[]`, want `[2.83]`
- **rcp-de** (cond:blur): type, date, currency, total, vat, items, no false alarm
  - vendor: got `"SCHNEIDER LOGISTIEAG"`, want `"SCHNEIDER LOGISTIK AG"`
  - number: got `null`, want `undefined`
  - date: got `null`, want `"2026-09-13"`
  - due: got `null`, want `undefined`
  - currency: got `"USD"`, want `"EUR"`
  - subtotal: got `null`, want `undefined`
  - total: got `4320`, want `43.2`
  - vat: got `[]`, want `[2.83]`
  - items: got `[4,165]`, want `[5.5,7.2,14,16.5]`
  - failed checks: Required fields; Line items add up
- **rcp-de** (cond:shake): type, vendor, date, currency, total, vat, items, no false alarm
  - vendor: got `"Berar uugssT unter = _=1"`, want `"SCHNEIDER LOGISTIK AG"`
  - number: got `null`, want `undefined`
  - date: got `null`, want `"2026-09-13"`
  - due: got `null`, want `undefined`
  - currency: got `"GBP"`, want `"EUR"`
  - subtotal: got `null`, want `undefined`
  - total: got `null`, want `43.2`
  - vat: got `[]`, want `[2.83]`
  - items: got `[]`, want `[5.5,7.2,14,16.5]`
  - failed checks: Required fields
- **rcp-de** (cond:whatsapp): items, no false alarm
  - number: got `null`, want `undefined`
  - due: got `null`, want `undefined`
  - subtotal: got `40.37`, want `undefined`
  - items: got `[5.5,14,16.5,720]`, want `[5.5,7.2,14,16.5]`
  - failed checks: Line items add up
- **rcp-de** (cond:perspective): items, no false alarm
  - number: got `null`, want `undefined`
  - due: got `null`, want `undefined`
  - subtotal: got `40.37`, want `undefined`
  - items: got `[5.5,7.2,16.5]`, want `[5.5,7.2,14,16.5]`
  - failed checks: Line items add up
- **rcp-de** (cond:hand-shadow): vendor, date
  - vendor: got `"SCHNEIDER AG"`, want `"SCHNEIDER LOGISTIK AG"`
  - number: got `null`, want `undefined`
  - date: got `"2020-09-13"`, want `"2026-09-13"`
  - due: got `null`, want `undefined`
  - subtotal: got `40.37`, want `undefined`
- **rcp-pl** (image): items, no false alarm
  - vendor: got `"DRUKARNIA WISNIEWSKI S.A."`, want `"DRUKARNIA WIŚNIEWSKI S.A."`
  - number: got `null`, want `undefined`
  - due: got `null`, want `undefined`
  - subtotal: got `7.31`, want `undefined`
  - items: got `[2.4,5750]`, want `[2.4,5.5]`
  - failed checks: Line items add up
- **rcp-en-JP** (image): vat, no false alarm
  - number: got `"6877"`, want `undefined`
  - due: got `null`, want `undefined`
  - subtotal: got `1517`, want `undefined`
  - vat: got `[123]`, want `[121]`
  - failed checks: VAT matches its rate
- **stm-tr-1** (cond:flash): amounts, no false alarm
  - amounts: got `[-825.57,764,968,-1729.09,8.73,-1566.69,1348.26,329.07,-162.59]`, want `[-825.57,-1305.74,-363.51,-1729.09,8.73,-1566.69,1348.26,329.07,-162.59]`
- **stm-tr-1** (cond:blur): transaction count, amounts, dates
  - n: got `3`, want `9`
  - amounts: got `[4,400,-87723.49]`, want `[-825.57,-1305.74,-363.51,-1729.09,8.73,-1566.69,1348.26,329.07,-162.59]`
  - dates: got `["2006-05-15","2026-05-08","2020-05-07"]`, want `["2026-05-03","2026-05-05","2026-05-07","2026-05-08","2026-05-11","2026-05-12","2026-05-14","2026-05-15","2026-05-17"]`
- **stm-tr-1** (cond:shake): type, transaction count, amounts, dates, no false alarm
  - n: got `0`, want `9`
  - amounts: got `[]`, want `[-825.57,-1305.74,-363.51,-1729.09,8.73,-1566.69,1348.26,329.07,-162.59]`
  - dates: got `[]`, want `["2026-05-03","2026-05-05","2026-05-07","2026-05-08","2026-05-11","2026-05-12","2026-05-14","2026-05-15","2026-05-17"]`
- **stm-tr-1** (cond:low-res): transaction count, amounts, dates, no false alarm
  - n: got `5`, want `9`
  - amounts: got `[1.31,383.51,812,329.07,3827.65]`, want `[-825.57,-1305.74,-363.51,-1729.09,8.73,-1566.69,1348.26,329.07,-162.59]`
  - dates: got `["2026-05-05","2028-05-07","2026-05-12","2026-05-15","2026-05-17"]`, want `["2026-05-03","2026-05-05","2026-05-07","2026-05-08","2026-05-11","2026-05-12","2026-05-14","2026-05-15","2026-05-17"]`
- **stm-tr-1** (cond:whatsapp): dates
  - dates: got `["2026-05-03","2026-05-05","2026-05-07","2026-05-08","2026-05-11","2026-05-12","2026-05-14","2026-05-16","2026-05-17"]`, want `["2026-05-03","2026-05-05","2026-05-07","2026-05-08","2026-05-11","2026-05-12","2026-05-14","2026-05-15","2026-05-17"]`
- **stm-tr-1** (cond:far-away): amounts, no false alarm
  - amounts: got `[825.57,-1305.74,-363.51,-1729.09,8.73,-1566.69,1348.26,329.07,-396186.35]`, want `[-825.57,-1305.74,-363.51,-1729.09,8.73,-1566.69,1348.26,329.07,-162.59]`
- **stm-pl-1** (image): amounts, no false alarm
  - amounts: got `[-1642.4,-1030.31,686.03,-428399.5,-688.55,-784.81,-1313.05,-709.53,-315.95,-426.91,-973.57,-1747.17]`, want `[-1642.4,-1030.31,-686.03,-311.62,-688.55,-784.81,-1313.05,-709.53,-315.95,-426.91,-973.57,-1747.17]`
- **stm-pl-1** (photo): transaction count, amounts, dates, no false alarm
  - n: got `11`, want `12`
  - amounts: got `[-1642.4,-1030.31,686.03,311.62,688.55,-329855.86,-1313.05,-709.53,-315.95,-426.91,-2720.74]`, want `[-1642.4,-1030.31,-686.03,-311.62,-688.55,-784.81,-1313.05,-709.53,-315.95,-426.91,-973.57,-1747.17]`
  - dates: got `["2026-09-04","2026-09-05","2026-09-08","2026-09-10","2026-09-12","2026-09-13","2026-09-16","2026-09-17","2026-09-20","2026-09-22","2026-09-27"]`, want `["2026-09-04","2026-09-05","2026-09-08","2026-09-10","2026-09-12","2026-09-13","2026-09-16","2026-09-17","2026-09-20","2026-09-22","2026-09-24","2026-09-27"]`
