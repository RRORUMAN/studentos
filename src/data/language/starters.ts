import type { PhrasePack } from "@/domain/language";

/**
 * ============================================================================
 * STARTER PACKS
 * ----------------------------------------------------------------------------
 * Six languages and English, at survival depth.
 *
 * These are DELIBERATELY SMALL and the product says so: `coverage: "starter"`
 * renders as "Starter pack" beside the language name, with the phrase count,
 * everywhere it appears. Eighteen carefully chosen phrases are worth having.
 * The same eighteen presented as "Estonian" is a promise the product cannot
 * keep, and the first student who goes looking for the word for deposit finds
 * out that it does not.
 *
 * What earned a place: the words that open a conversation, the two questions
 * that decide what something costs, and the sentence you need at a pharmacy.
 * Everything in these packs is high-frequency and unambiguous -- there is no
 * room here for a phrase that is right in one register and wrong in another.
 *
 * Respellings are sparser than in the full packs. Hungarian, Finnish and
 * Estonian have vowels English does not have, and half the entries here carry
 * no respelling because none would help. The play button uses the device's own
 * voice for the language, which is the honest source for those.
 *
 * ENGLISH is here for a reason that is easy to miss. London is one of the five
 * deep cities and the local language there is English -- which is not the same
 * as saying every international student already speaks it. The English pack is
 * shaped differently from the others: less "how do I say hello" and more the
 * specific vocabulary of British bureaucracy and shops, which is opaque even
 * to a fluent speaker who has never lived here.
 * ============================================================================
 */

export const polish: PhrasePack = {
  code: "pl",
  endonym: "Polski",
  name: "Polish",
  speechTag: "pl-PL",
  coverage: "starter",
  phrases: [
    { id: "pl.first-words.dzien-dobry", situation: "first-words", text: "Dzień dobry", meaning: "Good morning / good day", say: "jane DOH-bri", note: "The standard greeting for anyone you do not know.", tier: 1 },
    { id: "pl.first-words.czesc", situation: "first-words", text: "Cześć", meaning: "Hi", say: "cheshch", note: "For people your own age only.", tier: 1 },
    { id: "pl.first-words.dziekuje", situation: "first-words", text: "Dziękuję", meaning: "Thank you", say: "jen-KOO-yeh", note: null, tier: 1 },
    { id: "pl.first-words.prosze", situation: "first-words", text: "Proszę", meaning: "Please", say: "PRO-sheh", note: "Also here you go, and you're welcome.", tier: 1 },
    { id: "pl.first-words.przepraszam", situation: "first-words", text: "Przepraszam", meaning: "Excuse me / sorry", say: "psheh-PRA-sham", note: null, tier: 1 },
    { id: "pl.first-words.nie-rozumiem", situation: "first-words", text: "Nie rozumiem", meaning: "I don't understand", say: "nyeh ro-ZOO-myem", note: null, tier: 1 },
    { id: "pl.first-words.mowisz-po-angielsku", situation: "first-words", text: "Mówisz po angielsku?", meaning: "Do you speak English?", say: "MOO-veesh po an-GYEL-skoo", note: null, tier: 1 },
    { id: "pl.groceries.ile-kosztuje", situation: "groceries", text: "Ile to kosztuje?", meaning: "How much is it?", say: "EE-leh to kosh-TOO-yeh", note: null, tier: 1 },
    { id: "pl.groceries.gdzie-jest", situation: "groceries", text: "Gdzie jest ...?", meaning: "Where is...?", say: "gjeh yest", note: null, tier: 1 },
    { id: "pl.groceries.reklamowka", situation: "groceries", text: "Poproszę reklamówkę", meaning: "A bag, please", say: "po-PRO-sheh reh-kla-MOOF-keh", note: null, tier: 2 },
    { id: "pl.eating-out.rachunek", situation: "eating-out", text: "Rachunek, proszę", meaning: "The bill, please", say: "ra-HOO-nek PRO-sheh", note: null, tier: 1 },
    { id: "pl.eating-out.uczulony", situation: "eating-out", text: "Jestem uczulony na ...", meaning: "I'm allergic to ...", say: "YES-tem oo-choo-LO-ni na", note: "Uczulona if you are a woman.", tier: 1 },
    { id: "pl.money.karta", situation: "money", text: "Mogę zapłacić kartą?", meaning: "Can I pay by card?", say: "MO-geh za-PWA-cheech KAR-tom", note: "Card payment is near-universal in Poland.", tier: 1 },
    { id: "pl.money.znizka-studencka", situation: "money", text: "Czy jest zniżka studencka?", meaning: "Is there a student discount?", say: "chi yest ZNEESH-ka stoo-DENTS-ka", note: "Polish student cards also get large discounts on trains.", tier: 1 },
    { id: "pl.getting-around.bilet", situation: "getting-around", text: "Poproszę bilet", meaning: "One ticket, please", say: "po-PRO-sheh BEE-let", note: null, tier: 1 },
    { id: "pl.getting-around.jedzie-do", situation: "getting-around", text: "Czy to jedzie do ...?", meaning: "Does this go to...?", say: "chi to YEH-jeh do", note: null, tier: 1 },
    { id: "pl.emergency.apteka", situation: "emergency", text: "Apteka", meaning: "Pharmacy", say: "ap-TEH-ka", note: null, tier: 1 },
    { id: "pl.emergency.potrzebuje-lekarza", situation: "emergency", text: "Potrzebuję lekarza", meaning: "I need a doctor", say: "po-tsheh-BOO-yeh leh-KA-zha", note: "112 is the emergency number.", tier: 1 },
  ],
};

export const czech: PhrasePack = {
  code: "cs",
  endonym: "Čeština",
  name: "Czech",
  speechTag: "cs-CZ",
  coverage: "starter",
  phrases: [
    { id: "cs.first-words.dobry-den", situation: "first-words", text: "Dobrý den", meaning: "Good day", say: "DOH-bree den", note: "The standard greeting, used everywhere.", tier: 1 },
    { id: "cs.first-words.ahoj", situation: "first-words", text: "Ahoj", meaning: "Hi / bye", say: "a-HOY", note: "Casual, for people your own age.", tier: 1 },
    { id: "cs.first-words.dekuji", situation: "first-words", text: "Děkuji", meaning: "Thank you", say: "DYEH-koo-yi", note: null, tier: 1 },
    { id: "cs.first-words.prosim", situation: "first-words", text: "Prosím", meaning: "Please", say: "PRO-seem", note: "Also you're welcome, and pardon?", tier: 1 },
    { id: "cs.first-words.prominte", situation: "first-words", text: "Promiňte", meaning: "Excuse me", say: "PRO-min-teh", note: null, tier: 1 },
    { id: "cs.first-words.nerozumim", situation: "first-words", text: "Nerozumím", meaning: "I don't understand", say: "NEH-ro-zoo-meem", note: null, tier: 1 },
    { id: "cs.first-words.mluvite-anglicky", situation: "first-words", text: "Mluvíte anglicky?", meaning: "Do you speak English?", say: "MLOO-vee-teh AN-glits-ki", note: null, tier: 1 },
    { id: "cs.groceries.kolik-to-stoji", situation: "groceries", text: "Kolik to stojí?", meaning: "How much is it?", say: "KO-lik to STO-yee", note: null, tier: 1 },
    { id: "cs.groceries.kde-je", situation: "groceries", text: "Kde je ...?", meaning: "Where is...?", say: "gdeh yeh", note: null, tier: 1 },
    { id: "cs.eating-out.ucet", situation: "eating-out", text: "Účet, prosím", meaning: "The bill, please", say: "OO-chet PRO-seem", note: null, tier: 1 },
    { id: "cs.eating-out.alergie", situation: "eating-out", text: "Mám alergii na ...", meaning: "I'm allergic to ...", say: "mahm a-LER-gi-yi na", note: null, tier: 1 },
    { id: "cs.eating-out.pivo", situation: "eating-out", text: "Jedno pivo, prosím", meaning: "One beer, please", say: "YED-no PEE-vo", note: "In Czech pubs a fresh one arrives whenever your glass is empty until you say stop.", tier: 2 },
    { id: "cs.money.kartou", situation: "money", text: "Můžu platit kartou?", meaning: "Can I pay by card?", say: "MOO-zhoo PLA-tit KAR-tow", note: null, tier: 1 },
    { id: "cs.money.studentska-sleva", situation: "money", text: "Máte studentskou slevu?", meaning: "Do you have a student discount?", say: "MAH-teh STOO-dent-skow SLEH-voo", note: null, tier: 1 },
    { id: "cs.getting-around.jizdenka", situation: "getting-around", text: "Jízdenku, prosím", meaning: "One ticket, please", say: "YEEZ-den-koo PRO-seem", note: null, tier: 1 },
    { id: "cs.getting-around.jede-to-do", situation: "getting-around", text: "Jede to do ...?", meaning: "Does this go to...?", say: "YEH-deh to do", note: null, tier: 1 },
    { id: "cs.emergency.lekarna", situation: "emergency", text: "Lékárna", meaning: "Pharmacy", say: "LEH-kahr-na", note: null, tier: 1 },
    { id: "cs.emergency.potrebuji-lekare", situation: "emergency", text: "Potřebuji lékaře", meaning: "I need a doctor", say: "PO-tsheh-boo-yi LEH-ka-zheh", note: "112 is the emergency number.", tier: 1 },
  ],
};

export const hungarian: PhrasePack = {
  code: "hu",
  endonym: "Magyar",
  name: "Hungarian",
  speechTag: "hu-HU",
  coverage: "starter",
  phrases: [
    { id: "hu.first-words.jo-napot", situation: "first-words", text: "Jó napot", meaning: "Good day", say: "yoh NA-pot", note: "The polite greeting. Szia is the casual one.", tier: 1 },
    { id: "hu.first-words.szia", situation: "first-words", text: "Szia", meaning: "Hi / bye", say: "SEE-a", note: null, tier: 1 },
    { id: "hu.first-words.koszonom", situation: "first-words", text: "Köszönöm", meaning: "Thank you", say: null, note: "The vowels have no English equivalent. Use the play button.", tier: 1 },
    { id: "hu.first-words.kerem", situation: "first-words", text: "Kérem", meaning: "Please", say: "KAY-rem", note: null, tier: 1 },
    { id: "hu.first-words.elnezest", situation: "first-words", text: "Elnézést", meaning: "Excuse me", say: "EL-nay-zaysht", note: null, tier: 1 },
    { id: "hu.first-words.nem-ertem", situation: "first-words", text: "Nem értem", meaning: "I don't understand", say: "nem AYR-tem", note: null, tier: 1 },
    { id: "hu.first-words.beszel-angolul", situation: "first-words", text: "Beszél angolul?", meaning: "Do you speak English?", say: "BE-sayl AN-go-lool", note: null, tier: 1 },
    { id: "hu.groceries.mennyibe-kerul", situation: "groceries", text: "Mennyibe kerül?", meaning: "How much is it?", say: null, note: null, tier: 1 },
    { id: "hu.groceries.hol-van", situation: "groceries", text: "Hol van ...?", meaning: "Where is...?", say: "hol van", note: null, tier: 1 },
    { id: "hu.eating-out.a-szamlat", situation: "eating-out", text: "A számlát, kérem", meaning: "The bill, please", say: "a SAHM-laht KAY-rem", note: null, tier: 1 },
    { id: "hu.eating-out.allergias", situation: "eating-out", text: "Allergiás vagyok a ...", meaning: "I'm allergic to ...", say: "AL-ler-gee-ahsh VA-dyok a", note: null, tier: 1 },
    { id: "hu.money.kartyaval", situation: "money", text: "Fizethetek kártyával?", meaning: "Can I pay by card?", say: null, note: null, tier: 1 },
    { id: "hu.money.diakkedvezmeny", situation: "money", text: "Van diákkedvezmény?", meaning: "Is there a student discount?", say: null, note: null, tier: 1 },
    { id: "hu.getting-around.egy-jegyet", situation: "getting-around", text: "Egy jegyet, kérem", meaning: "One ticket, please", say: "edy YE-dyet KAY-rem", note: null, tier: 1 },
    { id: "hu.getting-around.megy-ez", situation: "getting-around", text: "Ez megy ...-ba?", meaning: "Does this go to...?", say: "ez medy", note: null, tier: 1 },
    { id: "hu.emergency.gyogyszertar", situation: "emergency", text: "Gyógyszertár", meaning: "Pharmacy", say: null, note: "Also signed as Patika.", tier: 1 },
    { id: "hu.emergency.orvosra-van-szuksegem", situation: "emergency", text: "Orvosra van szükségem", meaning: "I need a doctor", say: null, note: "112 is the emergency number.", tier: 1 },
  ],
};

export const finnish: PhrasePack = {
  code: "fi",
  endonym: "Suomi",
  name: "Finnish",
  speechTag: "fi-FI",
  coverage: "starter",
  phrases: [
    { id: "fi.first-words.hei", situation: "first-words", text: "Hei", meaning: "Hello", say: "hay", note: "Works in every situation. Moi is the casual version.", tier: 1 },
    { id: "fi.first-words.kiitos", situation: "first-words", text: "Kiitos", meaning: "Thank you", say: "KEE-tos", note: "Also used to mean please.", tier: 1 },
    { id: "fi.first-words.anteeksi", situation: "first-words", text: "Anteeksi", meaning: "Excuse me / sorry", say: "AN-tayk-si", note: null, tier: 1 },
    { id: "fi.first-words.en-ymmarra", situation: "first-words", text: "En ymmärrä", meaning: "I don't understand", say: null, note: null, tier: 1 },
    { id: "fi.first-words.puhutko-englantia", situation: "first-words", text: "Puhutko englantia?", meaning: "Do you speak English?", say: "POO-hoot-ko ENG-lan-ti-a", note: "Almost everyone under sixty does, fluently.", tier: 1 },
    { id: "fi.first-words.moikka", situation: "first-words", text: "Moikka", meaning: "Bye", say: "MOY-ka", note: null, tier: 1 },
    { id: "fi.groceries.paljonko-maksaa", situation: "groceries", text: "Paljonko tämä maksaa?", meaning: "How much is this?", say: "PAL-yon-ko TA-ma MAK-sah", note: null, tier: 1 },
    { id: "fi.groceries.missa-on", situation: "groceries", text: "Missä on ...?", meaning: "Where is...?", say: "MIS-sa on", note: null, tier: 1 },
    { id: "fi.groceries.pantti", situation: "groceries", text: "Pantti", meaning: "Bottle deposit", say: "PAN-ti", note: "Returned by the machine at the shop entrance.", tier: 2 },
    { id: "fi.eating-out.lasku", situation: "eating-out", text: "Lasku, kiitos", meaning: "The bill, please", say: "LAS-koo KEE-tos", note: null, tier: 1 },
    { id: "fi.eating-out.allerginen", situation: "eating-out", text: "Olen allerginen ...", meaning: "I'm allergic to ...", say: "O-len AL-ler-gi-nen", note: null, tier: 1 },
    { id: "fi.eating-out.lounas", situation: "eating-out", text: "Lounas", meaning: "The set lunch", say: "LOH-nas", note: "Weekday lunch at a fixed price, usually with salad, bread and coffee included. Much cheaper than dinner.", tier: 1 },
    { id: "fi.money.kortilla", situation: "money", text: "Voinko maksaa kortilla?", meaning: "Can I pay by card?", say: "VOYN-ko MAK-sah KOR-til-la", note: "Finland is almost entirely cashless.", tier: 1 },
    { id: "fi.money.opiskelija-alennus", situation: "money", text: "Onko opiskelija-alennusta?", meaning: "Is there a student discount?", say: "ON-ko O-pis-ke-li-ya-A-len-noos-ta", note: "Finnish student cards give large discounts on meals and transport.", tier: 1 },
    { id: "fi.getting-around.lippu", situation: "getting-around", text: "Yksi lippu, kiitos", meaning: "One ticket, please", say: "OOK-si LIP-poo", note: null, tier: 1 },
    { id: "fi.emergency.apteekki", situation: "emergency", text: "Apteekki", meaning: "Pharmacy", say: "AP-tayk-ki", note: null, tier: 1 },
    { id: "fi.emergency.tarvitsen-laakarin", situation: "emergency", text: "Tarvitsen lääkärin", meaning: "I need a doctor", say: null, note: "112 is the emergency number.", tier: 1 },
  ],
};

export const swedish: PhrasePack = {
  code: "sv",
  endonym: "Svenska",
  name: "Swedish",
  speechTag: "sv-SE",
  coverage: "starter",
  phrases: [
    { id: "sv.first-words.hej", situation: "first-words", text: "Hej", meaning: "Hello", say: "hay", note: "Used with everyone, in every situation.", tier: 1 },
    { id: "sv.first-words.tack", situation: "first-words", text: "Tack", meaning: "Thank you / please", say: "tak", note: "Swedish has no separate word for please. Tack does both jobs.", tier: 1 },
    { id: "sv.first-words.ursakta", situation: "first-words", text: "Ursäkta", meaning: "Excuse me", say: "oor-SEK-ta", note: null, tier: 1 },
    { id: "sv.first-words.jag-forstar-inte", situation: "first-words", text: "Jag förstår inte", meaning: "I don't understand", say: "yah fur-SHTOHR IN-teh", note: null, tier: 1 },
    { id: "sv.first-words.talar-du-engelska", situation: "first-words", text: "Talar du engelska?", meaning: "Do you speak English?", say: "TAH-lar doo ENG-el-ska", note: "Effectively everyone does.", tier: 1 },
    { id: "sv.first-words.hej-da", situation: "first-words", text: "Hej då", meaning: "Bye", say: "hay DOH", note: null, tier: 1 },
    { id: "sv.groceries.vad-kostar-det", situation: "groceries", text: "Vad kostar det?", meaning: "How much is it?", say: "vahd KOS-tar deh", note: null, tier: 1 },
    { id: "sv.groceries.var-finns", situation: "groceries", text: "Var finns ...?", meaning: "Where is...?", say: "vahr fins", note: null, tier: 1 },
    { id: "sv.groceries.pant", situation: "groceries", text: "Pant", meaning: "Bottle deposit", say: "pant", note: "Returned by the machine inside the supermarket.", tier: 2 },
    { id: "sv.eating-out.notan", situation: "eating-out", text: "Notan, tack", meaning: "The bill, please", say: "NOO-tan tak", note: null, tier: 1 },
    { id: "sv.eating-out.allergisk", situation: "eating-out", text: "Jag är allergisk mot ...", meaning: "I'm allergic to ...", say: "yah air a-LER-gisk moot", note: null, tier: 1 },
    { id: "sv.eating-out.dagens-lunch", situation: "eating-out", text: "Dagens lunch", meaning: "The lunch of the day", say: "DAH-gens lunsh", note: "A fixed-price weekday lunch with salad, bread and coffee included. The cheapest hot meal out.", tier: 1 },
    { id: "sv.eating-out.fika", situation: "eating-out", text: "Fika", meaning: "Coffee and something sweet, with people", say: "FEE-ka", note: "A social institution rather than a snack. Being invited to fika is being invited.", tier: 1 },
    { id: "sv.money.med-kort", situation: "money", text: "Kan jag betala med kort?", meaning: "Can I pay by card?", say: "kan yah be-TAH-la meh koort", note: "Sweden is effectively cashless; many places take nothing else.", tier: 1 },
    { id: "sv.money.studentrabatt", situation: "money", text: "Finns det studentrabatt?", meaning: "Is there a student discount?", say: "fins deh stoo-DENT-ra-bat", note: null, tier: 1 },
    { id: "sv.getting-around.en-biljett", situation: "getting-around", text: "En biljett, tack", meaning: "One ticket, please", say: "en bil-YET tak", note: null, tier: 1 },
    { id: "sv.emergency.apotek", situation: "emergency", text: "Apotek", meaning: "Pharmacy", say: "a-po-TAYK", note: null, tier: 1 },
    { id: "sv.emergency.behover-en-lakare", situation: "emergency", text: "Jag behöver en läkare", meaning: "I need a doctor", say: null, note: "112 is the emergency number. 1177 is the health advice line.", tier: 1 },
  ],
};

export const estonian: PhrasePack = {
  code: "et",
  endonym: "Eesti keel",
  name: "Estonian",
  speechTag: "et-EE",
  coverage: "starter",
  phrases: [
    { id: "et.first-words.tere", situation: "first-words", text: "Tere", meaning: "Hello", say: "TE-re", note: "Works everywhere, with anyone.", tier: 1 },
    { id: "et.first-words.aitah", situation: "first-words", text: "Aitäh", meaning: "Thank you", say: "AI-tah", note: null, tier: 1 },
    { id: "et.first-words.palun", situation: "first-words", text: "Palun", meaning: "Please", say: "PA-loon", note: "Also you're welcome, and here you go.", tier: 1 },
    { id: "et.first-words.vabandust", situation: "first-words", text: "Vabandust", meaning: "Excuse me / sorry", say: "VA-ban-doost", note: null, tier: 1 },
    { id: "et.first-words.ma-ei-saa-aru", situation: "first-words", text: "Ma ei saa aru", meaning: "I don't understand", say: "ma ay sah A-roo", note: null, tier: 1 },
    { id: "et.first-words.kas-raagite-inglise", situation: "first-words", text: "Kas räägite inglise keelt?", meaning: "Do you speak English?", say: null, note: "In Tallinn, nearly always yes.", tier: 1 },
    { id: "et.first-words.nagemist", situation: "first-words", text: "Nägemist", meaning: "Goodbye", say: "NA-ge-mist", note: null, tier: 1 },
    { id: "et.groceries.kui-palju-maksab", situation: "groceries", text: "Kui palju see maksab?", meaning: "How much is this?", say: "kui PAL-yu say MAK-sab", note: null, tier: 1 },
    { id: "et.groceries.kus-on", situation: "groceries", text: "Kus on ...?", meaning: "Where is...?", say: "koos on", note: null, tier: 1 },
    { id: "et.groceries.pandipakend", situation: "groceries", text: "Pandipakend", meaning: "Bottle deposit", say: "PAN-di-pa-kend", note: "Returned by the machine at the supermarket.", tier: 2 },
    { id: "et.eating-out.arve", situation: "eating-out", text: "Arve, palun", meaning: "The bill, please", say: "AR-ve PA-loon", note: null, tier: 1 },
    { id: "et.eating-out.allergia", situation: "eating-out", text: "Mul on allergia ...", meaning: "I'm allergic to ...", say: "mool on a-LER-gi-a", note: null, tier: 1 },
    { id: "et.eating-out.paevapraad", situation: "eating-out", text: "Päevapraad", meaning: "The dish of the day", say: null, note: "Weekday lunch at a fixed price. The cheapest hot meal out.", tier: 1 },
    { id: "et.money.kaardiga", situation: "money", text: "Kas saab kaardiga maksta?", meaning: "Can I pay by card?", say: "kas sahb KAAR-di-ga MAKS-ta", note: "Estonia is almost entirely cashless.", tier: 1 },
    { id: "et.money.tudengisoodustus", situation: "money", text: "Kas on tudengisoodustus?", meaning: "Is there a student discount?", say: "kas on TOO-den-gi-soh-doos-toos", note: null, tier: 1 },
    { id: "et.getting-around.pilet", situation: "getting-around", text: "Üks pilet, palun", meaning: "One ticket, please", say: null, note: "Public transport is free for registered Tallinn residents.", tier: 1 },
    { id: "et.emergency.apteek", situation: "emergency", text: "Apteek", meaning: "Pharmacy", say: "ap-TAYK", note: null, tier: 1 },
    { id: "et.emergency.vajan-arsti", situation: "emergency", text: "Ma vajan arsti", meaning: "I need a doctor", say: "ma VA-yan ARS-ti", note: "112 is the emergency number.", tier: 1 },
  ],
};

/**
 * English, shaped differently from every other pack.
 *
 * A student in London who does not speak much English needs the same first
 * words as anybody else. A student who speaks it fluently still does not know
 * what a council tax exemption is, or that "Oyster" is a travel card, or that
 * the number on a job advert is before tax. Both are in here.
 */
export const english: PhrasePack = {
  code: "en",
  endonym: "English",
  name: "English",
  speechTag: "en-GB",
  coverage: "starter",
  phrases: [
    { id: "en.first-words.excuse-me", situation: "first-words", text: "Excuse me", meaning: "To get someone's attention", say: null, note: "Britain runs on this and on sorry. Both are used far more than they need to be.", tier: 1 },
    { id: "en.first-words.sorry", situation: "first-words", text: "Sorry?", meaning: "I didn't catch that", say: null, note: "Said with a rising tone it means pardon, not an apology.", tier: 1 },
    { id: "en.first-words.you-alright", situation: "first-words", text: "You alright?", meaning: "Hello", say: null, note: "Not a question about your wellbeing. The answer is yeah, you?", tier: 1 },
    { id: "en.getting-around.oyster", situation: "getting-around", text: "Oyster / contactless", meaning: "How you pay for London transport", say: null, note: "Tap in and out with a bank card or phone. There is a daily cap, so you never pay more than a day pass would cost.", tier: 1 },
    { id: "en.getting-around.mind-the-gap", situation: "getting-around", text: "Mind the gap", meaning: "Watch the step onto the train", say: null, note: null, tier: 2 },
    { id: "en.getting-around.railcard", situation: "getting-around", text: "16-25 Railcard", meaning: "A discount card for trains", say: null, note: "Costs about the price of one long journey and takes a third off the rest for a year. It also links to an Oyster for off-peak discounts.", tier: 1 },
    { id: "en.money.council-tax", situation: "money", text: "Council tax exemption", meaning: "Students do not pay council tax", say: null, note: "Full-time students are exempt, but you have to claim it with a certificate from your university. Nobody applies it for you.", tier: 1 },
    { id: "en.money.student-discount", situation: "money", text: "Do you do student discount?", meaning: "Asking for the student price", say: null, note: "Widely offered and rarely advertised. Ask in shops, cinemas, barbers and restaurants.", tier: 1 },
    { id: "en.money.take-home", situation: "money", text: "Is that before or after tax?", meaning: "Checking what you will actually be paid", say: null, note: "Advertised wages are usually gross. Income tax and National Insurance come off.", tier: 1 },
    { id: "en.housing.deposit-scheme", situation: "housing", text: "Which deposit scheme is it in?", meaning: "Asking where your deposit is protected", say: null, note: "A landlord must place your deposit in a government-backed scheme within 30 days and tell you which. Ask before you pay.", tier: 1 },
    { id: "en.housing.bills-included", situation: "housing", text: "Are bills included?", meaning: "Asking what the rent covers", say: null, note: "Gas, electricity, water, internet and council tax are usually separate. Ask which are covered.", tier: 1 },
    { id: "en.housing.guarantor", situation: "housing", text: "Do I need a guarantor?", meaning: "Someone who covers the rent if you cannot", say: null, note: "Most private landlords require a UK-based one. Some accept a larger deposit or a guarantor service instead.", tier: 1 },
    { id: "en.university.tutorial", situation: "university", text: "Personal tutor", meaning: "The staff member assigned to you", say: null, note: "The person to email when something is going wrong. Most students never contact theirs.", tier: 2 },
    { id: "en.university.extension", situation: "university", text: "Can I apply for an extension?", meaning: "Asking for more time on a deadline", say: null, note: "There is a formal process, usually called mitigating circumstances. Apply before the deadline, not after.", tier: 1 },
    { id: "en.eating-out.tap-water", situation: "eating-out", text: "Just tap water, thanks", meaning: "Asking for free water", say: null, note: "Licensed premises must provide it free.", tier: 1 },
    { id: "en.eating-out.service-charge", situation: "eating-out", text: "Is service included?", meaning: "Checking for a service charge", say: null, note: "Often added automatically at 12.5%. You may ask for it to be removed.", tier: 1 },
    { id: "en.work.right-to-work", situation: "work", text: "Right to work check", meaning: "Proving you are allowed to work", say: null, note: "Every employer must do this before your first shift. A student visa usually limits your hours during term.", tier: 1 },
    { id: "en.emergency.nhs-111", situation: "emergency", text: "111", meaning: "The NHS advice line", say: null, note: "For anything urgent that is not an emergency. 999 is for emergencies. Register with a GP as soon as you arrive.", tier: 1 },
  ],
};
