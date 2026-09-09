import type { PhrasePack } from "@/domain/language";

/**
 * ============================================================================
 * GERMAN
 * ----------------------------------------------------------------------------
 * Written for Berlin, which is where the city record behind it is.
 *
 * Two conventions in the respellings. "kh" is the sound in "Bach", made at the
 * back of the throat -- English has no letter for it and pretending it is a k
 * gets you further than pretending it is nothing. "oo" with an umlaut behind
 * it (ue, oe) has no English equivalent at all, and those phrases carry no
 * respelling rather than a wrong one; the play button uses the device's own
 * German voice instead.
 *
 * Several notes here are worth more than the translation. Warmmiete against
 * Kaltmiete decides whether a flat is affordable. Anmeldung is the piece of
 * paper the bank, the university and the tax office all want and the one
 * nobody tells you about until you need it.
 * ============================================================================
 */

export const german: PhrasePack = {
  code: "de",
  endonym: "Deutsch",
  name: "German",
  speechTag: "de-DE",
  coverage: "core",
  phrases: [
    /* --- first words ---------------------------------------------------- */
    { id: "de.first-words.hallo", situation: "first-words", text: "Hallo", meaning: "Hello", say: "HA-lo", note: "Fine everywhere, with anyone.", tier: 1 },
    { id: "de.first-words.guten-tag", situation: "first-words", text: "Guten Tag", meaning: "Good day", say: "GOO-ten TAHK", note: "The polite one, for offices and older people.", tier: 1 },
    { id: "de.first-words.danke", situation: "first-words", text: "Danke", meaning: "Thank you", say: "DAN-ke", note: null, tier: 1 },
    { id: "de.first-words.bitte", situation: "first-words", text: "Bitte", meaning: "Please", say: "BI-te", note: "Also means you're welcome, here you go, and pardon? One word, four jobs.", tier: 1 },
    { id: "de.first-words.entschuldigung", situation: "first-words", text: "Entschuldigung", meaning: "Excuse me", say: "ent-SHOOL-di-gung", note: "Both for getting attention and for apologising.", tier: 1 },
    { id: "de.first-words.verstehe-nicht", situation: "first-words", text: "Ich verstehe nicht", meaning: "I don't understand", say: "ikh fer-SHTAY-e nikht", note: null, tier: 1 },
    { id: "de.first-words.sprechen-englisch", situation: "first-words", text: "Sprechen Sie Englisch?", meaning: "Do you speak English?", say: "SHPREH-khen zee ENG-lish", note: "In Berlin, usually yes. Asking in German first still changes the room.", tier: 1 },
    { id: "de.first-words.tschuess", situation: "first-words", text: "Tschüss", meaning: "Bye", say: null, note: "Roughly chuss, with the vowel in the French tu. Said constantly.", tier: 1 },

    /* --- getting around --------------------------------------------------- */
    { id: "de.getting-around.wo-ist-bahnhof", situation: "getting-around", text: "Wo ist der Bahnhof?", meaning: "Where is the station?", say: "vo ist der BAHN-hohf", note: null, tier: 1 },
    { id: "de.getting-around.fahrkarte", situation: "getting-around", text: "Eine Fahrkarte, bitte", meaning: "One ticket, please", say: "EYE-ne FAR-kar-te BI-te", note: null, tier: 1 },
    { id: "de.getting-around.welches-gleis", situation: "getting-around", text: "Welches Gleis?", meaning: "Which platform?", say: "VEL-khes glys", note: null, tier: 2 },
    { id: "de.getting-around.faehrt-nach", situation: "getting-around", text: "Fährt der nach ...?", meaning: "Does this one go to...?", say: "fairt der nakh", note: null, tier: 1 },
    { id: "de.getting-around.semesterticket", situation: "getting-around", text: "Das Semesterticket", meaning: "The semester travel pass", say: "das ze-MES-ter-ti-ket", note: "Charged with your enrolment fee at most Berlin universities, and then transport is already paid for. Check what it covers before buying anything else.", tier: 1 },
    { id: "de.getting-around.naechster-halt", situation: "getting-around", text: "Nächster Halt", meaning: "Next stop", say: null, note: "What the announcement says before it names the stop.", tier: 2 },

    /* --- groceries ------------------------------------------------------- */
    { id: "de.groceries.wie-viel", situation: "groceries", text: "Wie viel kostet das?", meaning: "How much is that?", say: "vee feel KOS-tet das", note: null, tier: 1 },
    { id: "de.groceries.wo-finde-ich", situation: "groceries", text: "Wo finde ich ...?", meaning: "Where do I find...?", say: "vo FIN-de ikh", note: null, tier: 1 },
    { id: "de.groceries.haben-sie", situation: "groceries", text: "Haben Sie ...?", meaning: "Do you have...?", say: "HA-ben zee", note: null, tier: 1 },
    { id: "de.groceries.tuete", situation: "groceries", text: "Eine Tüte, bitte", meaning: "A bag, please", say: null, note: "Bags are charged for. Bring one.", tier: 2 },
    { id: "de.groceries.pfand", situation: "groceries", text: "Das Pfand", meaning: "The bottle deposit", say: "das pfant", note: "Added to most bottles and cans and paid back by the machine at the shop entrance. Keep the receipt it prints and hand it in at the till.", tier: 1 },
    { id: "de.groceries.nur-das", situation: "groceries", text: "Nur das, danke", meaning: "Just this, thanks", say: "noor das DAN-ke", note: "German tills move fast. Have your bag open before you get there.", tier: 2 },

    /* --- eating out ------------------------------------------------------ */
    { id: "de.eating-out.tisch-fuer-zwei", situation: "eating-out", text: "Einen Tisch für zwei", meaning: "A table for two", say: null, note: null, tier: 1 },
    { id: "de.eating-out.speisekarte", situation: "eating-out", text: "Die Speisekarte, bitte", meaning: "The menu, please", say: "dee SHPY-ze-kar-te BI-te", note: null, tier: 1 },
    { id: "de.eating-out.haette-gern", situation: "eating-out", text: "Ich hätte gern ...", meaning: "I'd like ...", say: "ikh HET-e gairn", note: "The polite way to order anything.", tier: 1 },
    { id: "de.eating-out.ohne", situation: "eating-out", text: "Ohne ...", meaning: "Without ...", say: "OH-ne", note: null, tier: 2 },
    { id: "de.eating-out.allergisch", situation: "eating-out", text: "Ich bin allergisch gegen ...", meaning: "I'm allergic to ...", say: "ikh bin a-LER-gish GAY-gen", note: null, tier: 1 },
    { id: "de.eating-out.rechnung", situation: "eating-out", text: "Die Rechnung, bitte", meaning: "The bill, please", say: "dee REKH-nung BI-te", note: null, tier: 1 },
    { id: "de.eating-out.zusammen-getrennt", situation: "eating-out", text: "Zusammen oder getrennt?", meaning: "Together or separately?", say: "tsu-ZA-men OH-der ge-TRENT", note: "You will be ASKED this. Getrennt means each person pays their own, and it is completely normal.", tier: 1 },
    { id: "de.eating-out.leitungswasser", situation: "eating-out", text: "Leitungswasser", meaning: "Tap water", say: "LY-tungs-va-ser", note: "Often refused, and rarely free. Expect to buy bottled.", tier: 2 },

    /* --- money ----------------------------------------------------------- */
    { id: "de.money.mit-karte", situation: "money", text: "Kann ich mit Karte zahlen?", meaning: "Can I pay by card?", say: "kan ikh mit KAR-te TSA-len", note: "Ask before you order. Plenty of Berlin bars and bakeries still take only cash.", tier: 1 },
    { id: "de.money.nur-bargeld", situation: "money", text: "Nur Bargeld", meaning: "Cash only", say: "noor BAR-gelt", note: "On a sign by the door. Read it before sitting down.", tier: 1 },
    { id: "de.money.studentenrabatt", situation: "money", text: "Gibt es Studentenrabatt?", meaning: "Is there a student discount?", say: "gipt es shtu-DEN-ten-ra-bat", note: "Museums, cinemas, theatres and gyms nearly always have one. Carry the card.", tier: 1 },
    { id: "de.money.quittung", situation: "money", text: "Eine Quittung, bitte", meaning: "A receipt, please", say: "EYE-ne KVI-tung BI-te", note: null, tier: 2 },

    /* --- housing --------------------------------------------------------- */
    { id: "de.housing.miete", situation: "housing", text: "Die Miete", meaning: "The rent", say: "dee MEE-te", note: null, tier: 1 },
    { id: "de.housing.warm-kalt", situation: "housing", text: "Warmmiete oder Kaltmiete?", meaning: "Rent with or without bills?", say: "VARM-mee-te OH-der KALT-mee-te", note: "The single most important question about a German flat. Kaltmiete is the rent alone; Warmmiete includes heating and service charges. A listing showing Kaltmiete is cheaper than it looks.", tier: 1 },
    { id: "de.housing.kaution", situation: "housing", text: "Die Kaution", meaning: "The deposit", say: "dee kow-TSYOHN", note: "Legally capped at three months' Kaltmiete, and you may pay it in three instalments.", tier: 1 },
    { id: "de.housing.nebenkosten", situation: "housing", text: "Die Nebenkosten", meaning: "The service charges", say: "dee NAY-ben-kos-ten", note: "Water, rubbish, building upkeep. Settled once a year, so a bill can arrive months later.", tier: 2 },
    { id: "de.housing.anmeldung", situation: "housing", text: "Die Anmeldung", meaning: "Registering your address", say: "dee AN-mel-dung", note: "Done at a Bürgeramt. The certificate is what a bank, a phone contract and the tax office all ask for, so book the appointment the week you arrive.", tier: 1 },
    { id: "de.housing.vermieter", situation: "housing", text: "Der Vermieter", meaning: "The landlord", say: "der fer-MEE-ter", note: null, tier: 2 },
    { id: "de.housing.heizung", situation: "housing", text: "Die Heizung geht nicht", meaning: "The heating isn't working", say: "dee HY-tsung gayt nikht", note: null, tier: 2 },

    /* --- university ------------------------------------------------------ */
    { id: "de.university.immatrikulation", situation: "university", text: "Die Immatrikulation", meaning: "Enrolment", say: "dee i-ma-tri-ku-la-TSYOHN", note: null, tier: 1 },
    { id: "de.university.mensa", situation: "university", text: "Die Mensa", meaning: "The university canteen", say: "dee MEN-za", note: "A hot meal for a couple of euros with a student card. The cheapest food anywhere near campus.", tier: 1 },
    { id: "de.university.studentenwerk", situation: "university", text: "Das Studierendenwerk", meaning: "Student services", say: "das shtu-DEE-ren-den-verk", note: "Runs the halls, the canteens and the counselling. The first place to ask about housing.", tier: 1 },
    { id: "de.university.bibliothek", situation: "university", text: "Die Bibliothek", meaning: "The library", say: "dee bi-blee-o-TAYK", note: null, tier: 1 },
    { id: "de.university.abgabe", situation: "university", text: "Wann ist die Abgabe?", meaning: "When is the deadline?", say: "van ist dee AP-ga-be", note: null, tier: 2 },

    /* --- meeting people -------------------------------------------------- */
    { id: "de.meeting-people.wie-heisst-du", situation: "meeting-people", text: "Wie heißt du?", meaning: "What's your name?", say: "vee hyst doo", note: null, tier: 1 },
    { id: "de.meeting-people.ich-heisse", situation: "meeting-people", text: "Ich heiße ...", meaning: "My name is ...", say: "ikh HY-se", note: null, tier: 1 },
    { id: "de.meeting-people.woher-kommst-du", situation: "meeting-people", text: "Woher kommst du?", meaning: "Where are you from?", say: "vo-HAIR komst doo", note: null, tier: 1 },
    { id: "de.meeting-people.hast-du-lust", situation: "meeting-people", text: "Hast du Lust?", meaning: "Do you fancy it?", say: "hast doo loost", note: "How an invitation is actually phrased.", tier: 2 },
    { id: "de.meeting-people.was-trinken", situation: "meeting-people", text: "Wollen wir was trinken?", meaning: "Shall we get a drink?", say: "VO-len veer vas TRIN-ken", note: null, tier: 2 },

    /* --- work ------------------------------------------------------------ */
    { id: "de.work.suche-job", situation: "work", text: "Ich suche einen Job", meaning: "I'm looking for a job", say: "ikh ZOO-khe EYE-nen job", note: null, tier: 1 },
    { id: "de.work.stellen-sie-ein", situation: "work", text: "Stellen Sie gerade ein?", meaning: "Are you hiring at the moment?", say: "SHTE-len zee ge-RA-de eyn", note: null, tier: 1 },
    { id: "de.work.arbeitszeiten", situation: "work", text: "Wie sind die Arbeitszeiten?", meaning: "What are the hours?", say: "vee zint dee AR-bites-tsy-ten", note: null, tier: 1 },
    { id: "de.work.wie-viel-zahlt", situation: "work", text: "Wie viel zahlt ihr?", meaning: "How much do you pay?", say: "vee feel tsalt eer", note: null, tier: 1 },
    { id: "de.work.minijob", situation: "work", text: "Ist das ein Minijob?", meaning: "Is this a Minijob?", say: "ist das eyn MI-ni-job", note: "A Minijob and a Werkstudent contract are taxed differently and count differently against a student visa. Ask which one is being offered before you agree.", tier: 2 },

    /* --- emergency -------------------------------------------------------- */
    { id: "de.emergency.hilfe", situation: "emergency", text: "Hilfe!", meaning: "Help!", say: "HIL-fe", note: null, tier: 1 },
    { id: "de.emergency.apotheke", situation: "emergency", text: "Die Apotheke", meaning: "The pharmacy", say: "dee a-po-TAY-ke", note: "Marked with a red A. Closed on Sundays, but one in each district stays open on rota.", tier: 1 },
    { id: "de.emergency.brauche-arzt", situation: "emergency", text: "Ich brauche einen Arzt", meaning: "I need a doctor", say: "ikh BROW-khe EYE-nen artst", note: null, tier: 1 },
    { id: "de.emergency.geht-nicht-gut", situation: "emergency", text: "Mir geht es nicht gut", meaning: "I don't feel well", say: "meer gayt es nikht goot", note: null, tier: 1 },
    { id: "de.emergency.notaufnahme", situation: "emergency", text: "Die Notaufnahme", meaning: "A&E", say: "dee NOHT-owf-na-me", note: "112 is the emergency number across the EU and works from any phone.", tier: 1 },
    { id: "de.emergency.versichert", situation: "emergency", text: "Ich bin versichert", meaning: "I have insurance", say: "ikh bin fer-ZI-khert", note: "Carry the card. Health insurance is compulsory to enrol in Germany.", tier: 2 },
  ],
};
