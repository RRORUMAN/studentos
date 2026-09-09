import type { PhrasePack } from "@/domain/language";

/**
 * ============================================================================
 * ITALIAN
 * ----------------------------------------------------------------------------
 * Italian spelling is close to phonetic, so nearly every phrase here carries a
 * respelling and nearly all of them get you understood. The stress is the part
 * English speakers get wrong, so it is marked in capitals throughout.
 *
 * The notes carry the things that cost money: coperto, the cover charge that
 * appears on every restaurant bill; the difference between drinking a coffee
 * standing at the bar and sitting at a table, which can double the price.
 * ============================================================================
 */

export const italian: PhrasePack = {
  code: "it",
  endonym: "Italiano",
  name: "Italian",
  speechTag: "it-IT",
  coverage: "core",
  phrases: [
    /* --- first words ---------------------------------------------------- */
    { id: "it.first-words.ciao", situation: "first-words", text: "Ciao", meaning: "Hi / bye", say: "chow", note: "Casual, and for people your own age. Use buongiorno with anyone behind a counter.", tier: 1 },
    { id: "it.first-words.buongiorno", situation: "first-words", text: "Buongiorno", meaning: "Good morning", say: "bwon-JOR-no", note: "Until mid-afternoon, then buonasera.", tier: 1 },
    { id: "it.first-words.grazie", situation: "first-words", text: "Grazie", meaning: "Thank you", say: "GRAT-tsee-eh", note: "Three syllables, not two.", tier: 1 },
    { id: "it.first-words.per-favore", situation: "first-words", text: "Per favore", meaning: "Please", say: "pair fa-VO-reh", note: null, tier: 1 },
    { id: "it.first-words.scusi", situation: "first-words", text: "Scusi", meaning: "Excuse me", say: "SKOO-zee", note: "Scusa to someone your own age.", tier: 1 },
    { id: "it.first-words.non-capisco", situation: "first-words", text: "Non capisco", meaning: "I don't understand", say: "non ka-PEES-ko", note: null, tier: 1 },
    { id: "it.first-words.parla-inglese", situation: "first-words", text: "Parla inglese?", meaning: "Do you speak English?", say: "PAR-la in-GLAY-zeh", note: null, tier: 1 },

    /* --- getting around --------------------------------------------------- */
    { id: "it.getting-around.dove-la-stazione", situation: "getting-around", text: "Dov'è la stazione?", meaning: "Where is the station?", say: "do-VEH la stat-TSYO-neh", note: null, tier: 1 },
    { id: "it.getting-around.un-biglietto", situation: "getting-around", text: "Un biglietto, per favore", meaning: "One ticket, please", say: "oon beel-YET-to", note: null, tier: 1 },
    { id: "it.getting-around.obliterare", situation: "getting-around", text: "Obliterare il biglietto", meaning: "Validate the ticket", say: "o-blee-teh-RA-reh eel beel-YET-to", note: "Stamp it in the machine before boarding. An unstamped ticket is treated as no ticket and the fine is large.", tier: 1 },
    { id: "it.getting-around.quale-binario", situation: "getting-around", text: "Quale binario?", meaning: "Which platform?", say: "KWA-leh bee-NA-ryo", note: null, tier: 2 },
    { id: "it.getting-around.va-a", situation: "getting-around", text: "Va a ...?", meaning: "Does it go to...?", say: "va a", note: null, tier: 1 },

    /* --- groceries ------------------------------------------------------- */
    { id: "it.groceries.quanto-costa", situation: "groceries", text: "Quanto costa?", meaning: "How much is it?", say: "KWAN-to KOS-ta", note: null, tier: 1 },
    { id: "it.groceries.dove-si-trova", situation: "groceries", text: "Dove si trova ...?", meaning: "Where is...?", say: "DO-veh see TRO-va", note: null, tier: 1 },
    { id: "it.groceries.avete", situation: "groceries", text: "Avete ...?", meaning: "Do you have...?", say: "a-VEH-teh", note: null, tier: 1 },
    { id: "it.groceries.guanti", situation: "groceries", text: "I guanti", meaning: "The gloves", say: "ee GWAN-tee", note: "In Italian supermarkets you put on a plastic glove before touching loose fruit and vegetables, and weigh them yourself.", tier: 2 },
    { id: "it.groceries.basta-cosi", situation: "groceries", text: "Basta così, grazie", meaning: "That's everything, thanks", say: "BAS-ta ko-ZEE", note: null, tier: 1 },

    /* --- eating out ------------------------------------------------------ */
    { id: "it.eating-out.un-tavolo", situation: "eating-out", text: "Un tavolo per due", meaning: "A table for two", say: "oon TA-vo-lo pair DOO-eh", note: null, tier: 1 },
    { id: "it.eating-out.il-menu", situation: "eating-out", text: "Il menù, per favore", meaning: "The menu, please", say: "eel meh-NOO", note: null, tier: 1 },
    { id: "it.eating-out.coperto", situation: "eating-out", text: "Il coperto", meaning: "The cover charge", say: "eel ko-PAIR-to", note: "A per-person charge added to almost every restaurant bill, usually one to three euros. It is legal and not a tip.", tier: 1 },
    { id: "it.eating-out.al-banco", situation: "eating-out", text: "Al banco", meaning: "At the bar", say: "al BAN-ko", note: "A coffee drunk standing at the counter costs about a euro. The same coffee at a table can cost three times that.", tier: 1 },
    { id: "it.eating-out.sono-allergico", situation: "eating-out", text: "Sono allergico a ...", meaning: "I'm allergic to ...", say: "SO-no al-LAIR-jee-ko a", note: "Allergica if you are a woman.", tier: 1 },
    { id: "it.eating-out.il-conto", situation: "eating-out", text: "Il conto, per favore", meaning: "The bill, please", say: "eel KON-to", note: null, tier: 1 },
    { id: "it.eating-out.acqua-del-rubinetto", situation: "eating-out", text: "Acqua del rubinetto", meaning: "Tap water", say: "AK-kwa del roo-bee-NET-to", note: "Often not offered and sometimes refused; bottled water is the norm.", tier: 2 },

    /* --- money ----------------------------------------------------------- */
    { id: "it.money.posso-pagare-carta", situation: "money", text: "Posso pagare con la carta?", meaning: "Can I pay by card?", say: "POS-so pa-GA-reh kon la KAR-ta", note: null, tier: 1 },
    { id: "it.money.sconto-studenti", situation: "money", text: "C'è lo sconto studenti?", meaning: "Is there a student discount?", say: "cheh lo SKON-to stoo-DEN-tee", note: "Under 26 gets reduced or free entry to state museums. Carry ID.", tier: 1 },
    { id: "it.money.la-caparra", situation: "money", text: "La caparra", meaning: "The deposit", say: "la ka-PAR-ra", note: null, tier: 1 },
    { id: "it.money.lo-scontrino", situation: "money", text: "Lo scontrino", meaning: "The receipt", say: "lo skon-TREE-no", note: "Keep it. In some bars you pay at the till first and hand the receipt to the barista.", tier: 1 },

    /* --- housing --------------------------------------------------------- */
    { id: "it.housing.laffitto", situation: "housing", text: "L'affitto", meaning: "The rent", say: "laf-FEET-to", note: null, tier: 1 },
    { id: "it.housing.spese-incluse", situation: "housing", text: "Spese incluse?", meaning: "Are bills included?", say: "SPEH-zeh in-KLOO-zeh", note: null, tier: 1 },
    { id: "it.housing.il-contratto", situation: "housing", text: "Il contratto", meaning: "The contract", say: "eel kon-TRAT-to", note: "A registered contract is what lets you get a residence permit and a residency certificate. Ask whether it will be registered.", tier: 1 },
    { id: "it.housing.il-codice-fiscale", situation: "housing", text: "Il codice fiscale", meaning: "The tax code", say: "eel KO-dee-cheh fees-KA-leh", note: "Needed for a lease, a phone contract, a bank account and enrolment. Get it in your first week.", tier: 1 },
    { id: "it.housing.non-funziona", situation: "housing", text: "Non funziona ...", meaning: "The ... isn't working", say: "non foon-TSYO-na", note: null, tier: 2 },

    /* --- university ------------------------------------------------------ */
    { id: "it.university.immatricolazione", situation: "university", text: "L'immatricolazione", meaning: "Enrolment", say: "lim-ma-tree-ko-lat-TSYO-neh", note: null, tier: 1 },
    { id: "it.university.la-segreteria", situation: "university", text: "La segreteria", meaning: "The admin office", say: "la seh-greh-teh-REE-a", note: "Where every piece of paperwork is settled. Go in person.", tier: 1 },
    { id: "it.university.la-mensa", situation: "university", text: "La mensa", meaning: "The university canteen", say: "la MEN-sa", note: "Run by the regional student body. A full meal costs a few euros with a student card.", tier: 1 },
    { id: "it.university.lappello", situation: "university", text: "L'appello", meaning: "The exam sitting", say: "lap-PEL-lo", note: "Italian exams are offered at several sittings a year and you register for the one you want.", tier: 2 },

    /* --- meeting people -------------------------------------------------- */
    { id: "it.meeting-people.come-ti-chiami", situation: "meeting-people", text: "Come ti chiami?", meaning: "What's your name?", say: "KO-meh tee KYA-mee", note: null, tier: 1 },
    { id: "it.meeting-people.mi-chiamo", situation: "meeting-people", text: "Mi chiamo ...", meaning: "My name is ...", say: "mee KYA-mo", note: null, tier: 1 },
    { id: "it.meeting-people.di-dove-sei", situation: "meeting-people", text: "Di dove sei?", meaning: "Where are you from?", say: "dee DO-veh SAY", note: null, tier: 1 },
    { id: "it.meeting-people.ci-vediamo", situation: "meeting-people", text: "Ci vediamo!", meaning: "See you!", say: "chee veh-DYA-mo", note: null, tier: 1 },
    { id: "it.meeting-people.andiamo-a-bere", situation: "meeting-people", text: "Andiamo a bere qualcosa?", meaning: "Shall we get a drink?", say: "an-DYA-mo a BEH-reh kwal-KO-za", note: "Ask about aperitivo: a drink that comes with enough food to be dinner.", tier: 2 },

    /* --- work ------------------------------------------------------------ */
    { id: "it.work.cerco-lavoro", situation: "work", text: "Cerco lavoro", meaning: "I'm looking for work", say: "CHAIR-ko la-VO-ro", note: null, tier: 1 },
    { id: "it.work.state-assumendo", situation: "work", text: "State assumendo?", meaning: "Are you hiring?", say: "STA-teh as-soo-MEN-do", note: null, tier: 1 },
    { id: "it.work.che-orari", situation: "work", text: "Che orari sono?", meaning: "What are the hours?", say: "keh o-RA-ree SO-no", note: null, tier: 1 },
    { id: "it.work.quanto-si-guadagna", situation: "work", text: "Quanto si guadagna?", meaning: "What does it pay?", say: "KWAN-to see gwa-DAN-ya", note: null, tier: 1 },

    /* --- emergency -------------------------------------------------------- */
    { id: "it.emergency.aiuto", situation: "emergency", text: "Aiuto!", meaning: "Help!", say: "a-YOO-to", note: null, tier: 1 },
    { id: "it.emergency.la-farmacia", situation: "emergency", text: "La farmacia", meaning: "The pharmacy", say: "la far-ma-CHEE-a", note: "Green cross. One in each area stays open at night on rota; the list is posted on the door.", tier: 1 },
    { id: "it.emergency.ho-bisogno-di-un-medico", situation: "emergency", text: "Ho bisogno di un medico", meaning: "I need a doctor", say: "o bee-ZON-yo dee oon MEH-dee-ko", note: null, tier: 1 },
    { id: "it.emergency.mi-sento-male", situation: "emergency", text: "Mi sento male", meaning: "I feel ill", say: "mee SEN-to MA-leh", note: null, tier: 1 },
    { id: "it.emergency.il-pronto-soccorso", situation: "emergency", text: "Il pronto soccorso", meaning: "A&E", say: "eel PRON-to sok-KOR-so", note: "112 is the emergency number.", tier: 1 },
  ],
};
