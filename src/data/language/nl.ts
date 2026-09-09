import type { PhrasePack } from "@/domain/language";

/**
 * ============================================================================
 * DUTCH
 * ----------------------------------------------------------------------------
 * Written for Amsterdam, and written knowing that almost everybody there
 * speaks excellent English. That is not an argument against the pack, it is
 * what shapes it: a student in Amsterdam does not need Dutch to be understood,
 * they need it to read a rental listing, to know what the machine at the
 * station is telling them, and to be treated as somebody who lives there
 * rather than somebody visiting.
 *
 * So the weight here sits on housing, money and the things printed on signs,
 * and less on conversation than the Spanish pack.
 *
 * Respellings use "kh" for the Dutch g, which is a hard sound at the back of
 * the throat and is not an English g under any circumstances. Where a vowel
 * has no English equivalent at all -- ui, eu -- the phrase carries no
 * respelling and the play button uses the device's Dutch voice instead.
 * ============================================================================
 */

export const dutch: PhrasePack = {
  code: "nl",
  endonym: "Nederlands",
  name: "Dutch",
  speechTag: "nl-NL",
  coverage: "core",
  phrases: [
    /* --- first words ---------------------------------------------------- */
    { id: "nl.first-words.hallo", situation: "first-words", text: "Hallo", meaning: "Hello", say: "HA-loh", note: null, tier: 1 },
    { id: "nl.first-words.goedemorgen", situation: "first-words", text: "Goedemorgen", meaning: "Good morning", say: "khoo-de-MOR-khe", note: "Both g sounds are the throaty kh. Nobody expects you to get it right.", tier: 1 },
    { id: "nl.first-words.dank-je-wel", situation: "first-words", text: "Dank je wel", meaning: "Thank you", say: "dank ye vel", note: "Dank u wel to somebody older or behind a counter.", tier: 1 },
    { id: "nl.first-words.alsjeblieft", situation: "first-words", text: "Alsjeblieft", meaning: "Please", say: "ALS-ye-bleeft", note: "Also what someone says as they hand you something.", tier: 1 },
    { id: "nl.first-words.sorry", situation: "first-words", text: "Sorry", meaning: "Sorry / excuse me", say: "SO-ree", note: "Said in English, by everyone, constantly.", tier: 1 },
    { id: "nl.first-words.begrijp-niet", situation: "first-words", text: "Ik begrijp het niet", meaning: "I don't understand", say: "ik be-KHRYP het neet", note: null, tier: 1 },
    { id: "nl.first-words.spreek-engels", situation: "first-words", text: "Spreek je Engels?", meaning: "Do you speak English?", say: "sprayk ye ENG-els", note: "The answer is almost always yes, and usually very good English.", tier: 1 },
    { id: "nl.first-words.doei", situation: "first-words", text: "Doei", meaning: "Bye", say: "DOO-ee", note: "Casual and everywhere. Tot ziens is the formal one.", tier: 1 },

    /* --- getting around --------------------------------------------------- */
    { id: "nl.getting-around.waar-is-station", situation: "getting-around", text: "Waar is het station?", meaning: "Where is the station?", say: "vahr is het sta-SHON", note: null, tier: 1 },
    { id: "nl.getting-around.ov-chipkaart", situation: "getting-around", text: "De OV-chipkaart", meaning: "The travel card", say: "de oh-vay-CHIP-kahrt", note: "Check in AND check out, every single time, including on the tram. Forgetting to check out charges you the maximum fare for that journey.", tier: 1 },
    { id: "nl.getting-around.welk-spoor", situation: "getting-around", text: "Welk spoor?", meaning: "Which platform?", say: "velk spohr", note: null, tier: 2 },
    { id: "nl.getting-around.gaat-deze-naar", situation: "getting-around", text: "Gaat deze naar ...?", meaning: "Does this one go to...?", say: "khaht DAY-ze nahr", note: null, tier: 1 },
    { id: "nl.getting-around.fiets", situation: "getting-around", text: "De fiets", meaning: "The bike", say: "de feets", note: "Buy two locks and use both. Bike theft in Amsterdam is constant and insurance rarely covers it.", tier: 1 },
    { id: "nl.getting-around.storing", situation: "getting-around", text: "Storing", meaning: "Service disruption", say: "STOH-ring", note: "The word on the screen when your train is not coming.", tier: 2 },

    /* --- groceries ------------------------------------------------------- */
    { id: "nl.groceries.hoeveel-kost", situation: "groceries", text: "Hoeveel kost het?", meaning: "How much is it?", say: "HOO-vayl kost het", note: null, tier: 1 },
    { id: "nl.groceries.waar-vind-ik", situation: "groceries", text: "Waar vind ik ...?", meaning: "Where do I find...?", say: "vahr vint ik", note: null, tier: 1 },
    { id: "nl.groceries.heeft-u", situation: "groceries", text: "Heeft u ...?", meaning: "Do you have...?", say: "hayft oo", note: null, tier: 1 },
    { id: "nl.groceries.statiegeld", situation: "groceries", text: "Statiegeld", meaning: "Bottle deposit", say: "STAH-tsee-khelt", note: "On bottles and cans. The machine at the shop entrance prints a voucher you hand in at the till.", tier: 1 },
    { id: "nl.groceries.bonus", situation: "groceries", text: "Bonus", meaning: "On offer", say: "BOH-nus", note: "The word on the yellow shelf labels at Albert Heijn. Some offers need the shop's free card to apply.", tier: 1 },
    { id: "nl.groceries.tasje", situation: "groceries", text: "Een tasje, alstublieft", meaning: "A bag, please", say: null, note: "Charged for, and you pack your own, fast.", tier: 2 },

    /* --- eating out ------------------------------------------------------ */
    { id: "nl.eating-out.tafel-voor-twee", situation: "eating-out", text: "Een tafel voor twee", meaning: "A table for two", say: "un TAH-fel vohr tvay", note: null, tier: 1 },
    { id: "nl.eating-out.de-kaart", situation: "eating-out", text: "De kaart, alstublieft", meaning: "The menu, please", say: "de kahrt", note: null, tier: 1 },
    { id: "nl.eating-out.ik-wil-graag", situation: "eating-out", text: "Ik wil graag ...", meaning: "I'd like ...", say: "ik vil khrahkh", note: null, tier: 1 },
    { id: "nl.eating-out.zonder", situation: "eating-out", text: "Zonder ...", meaning: "Without ...", say: "ZON-der", note: null, tier: 2 },
    { id: "nl.eating-out.allergisch", situation: "eating-out", text: "Ik ben allergisch voor ...", meaning: "I'm allergic to ...", say: "ik ben a-LER-khees vohr", note: null, tier: 1 },
    { id: "nl.eating-out.de-rekening", situation: "eating-out", text: "De rekening, alstublieft", meaning: "The bill, please", say: "de RAY-ke-ning", note: null, tier: 1 },
    { id: "nl.eating-out.kan-ik-pinnen", situation: "eating-out", text: "Kan ik pinnen?", meaning: "Can I pay by card?", say: "kan ik PI-nen", note: "Pinnen means paying by debit card. Many places take only that, and a foreign credit card is often refused.", tier: 1 },

    /* --- money ----------------------------------------------------------- */
    { id: "nl.money.alleen-pin", situation: "money", text: "Alleen pin", meaning: "Card only", say: "a-LAYN pin", note: "On the door of a great many Dutch shops. Get a Dutch debit card early.", tier: 1 },
    { id: "nl.money.studentenkorting", situation: "money", text: "Is er studentenkorting?", meaning: "Is there a student discount?", say: "is er stu-DEN-ten-kor-ting", note: null, tier: 1 },
    { id: "nl.money.de-borg", situation: "money", text: "De borg", meaning: "The deposit", say: "de borkh", note: "Usually one or two months' rent. Get the terms in writing.", tier: 1 },
    { id: "nl.money.contant", situation: "money", text: "Contant", meaning: "Cash", say: "kon-TANT", note: null, tier: 2 },

    /* --- housing --------------------------------------------------------- */
    { id: "nl.housing.de-huur", situation: "housing", text: "De huur", meaning: "The rent", say: null, note: "Said roughly hoor, with the vowel English does not have.", tier: 1 },
    { id: "nl.housing.inclusief", situation: "housing", text: "Inclusief of exclusief?", meaning: "Bills included or not?", say: "in-kloo-SEEF of eks-kloo-SEEF", note: "A listing marked excl. does not include gas, water, electricity or internet, and those add up fast. Ask for the all-in figure.", tier: 1 },
    { id: "nl.housing.huisbaas", situation: "housing", text: "De huisbaas", meaning: "The landlord", say: null, note: null, tier: 2 },
    { id: "nl.housing.inschrijven", situation: "housing", text: "Inschrijven bij de gemeente", meaning: "Registering with the council", say: "IN-skhry-ven by de khe-MAYN-te", note: "This is how you get a BSN, the citizen number that a bank, an employer and a doctor all need. Your landlord has to allow it -- an address that will not let you register is a problem, not a detail.", tier: 1 },
    { id: "nl.housing.doet-het-niet", situation: "housing", text: "De verwarming doet het niet", meaning: "The heating isn't working", say: "de ver-VAR-ming doot het neet", note: null, tier: 2 },

    /* --- university ------------------------------------------------------ */
    { id: "nl.university.inschrijving", situation: "university", text: "De inschrijving", meaning: "Enrolment", say: "de IN-skhry-ving", note: null, tier: 1 },
    { id: "nl.university.collegekaart", situation: "university", text: "De collegekaart", meaning: "The student card", say: "de ko-LAY-khe-kahrt", note: null, tier: 1 },
    { id: "nl.university.bibliotheek", situation: "university", text: "De bibliotheek", meaning: "The library", say: "de bee-blee-oh-TAYK", note: null, tier: 1 },
    { id: "nl.university.studieadviseur", situation: "university", text: "De studieadviseur", meaning: "The academic adviser", say: "de STU-dee-at-vee-seur", note: "The person to email when something goes wrong with a deadline. Earlier is better.", tier: 2 },

    /* --- meeting people -------------------------------------------------- */
    { id: "nl.meeting-people.hoe-heet-je", situation: "meeting-people", text: "Hoe heet je?", meaning: "What's your name?", say: "hoo hayt ye", note: null, tier: 1 },
    { id: "nl.meeting-people.ik-heet", situation: "meeting-people", text: "Ik heet ...", meaning: "My name is ...", say: "ik hayt", note: null, tier: 1 },
    { id: "nl.meeting-people.waar-kom-je-vandaan", situation: "meeting-people", text: "Waar kom je vandaan?", meaning: "Where are you from?", say: "vahr kom ye van-DAHN", note: null, tier: 1 },
    { id: "nl.meeting-people.zin-om-mee-te-gaan", situation: "meeting-people", text: "Zin om mee te gaan?", meaning: "Fancy coming along?", say: "zin om may te khahn", note: null, tier: 2 },
    { id: "nl.meeting-people.gezellig", situation: "meeting-people", text: "Gezellig", meaning: "Cosy, in good company", say: "khe-ZEL-likh", note: "There is no English word for it. It describes a room, an evening or a person, and you will hear it every day.", tier: 1 },

    /* --- work ------------------------------------------------------------ */
    { id: "nl.work.zoek-werk", situation: "work", text: "Ik zoek werk", meaning: "I'm looking for work", say: "ik zook verk", note: null, tier: 1 },
    { id: "nl.work.vacatures", situation: "work", text: "Hebben jullie vacatures?", meaning: "Do you have any openings?", say: "HE-ben YU-lee va-ka-TOO-res", note: null, tier: 1 },
    { id: "nl.work.wat-zijn-de-uren", situation: "work", text: "Wat zijn de uren?", meaning: "What are the hours?", say: "vat zyn de OO-ren", note: null, tier: 1 },
    { id: "nl.work.wat-betaalt-het", situation: "work", text: "Wat betaalt het?", meaning: "What does it pay?", say: "vat be-TAHLT het", note: null, tier: 1 },

    /* --- emergency -------------------------------------------------------- */
    { id: "nl.emergency.help", situation: "emergency", text: "Help!", meaning: "Help!", say: "help", note: null, tier: 1 },
    { id: "nl.emergency.apotheek", situation: "emergency", text: "De apotheek", meaning: "The pharmacy", say: "de a-po-TAYK", note: "The drogist sells toiletries; the apotheek is where prescriptions are filled.", tier: 1 },
    { id: "nl.emergency.huisarts", situation: "emergency", text: "De huisarts", meaning: "The GP", say: null, note: "Register with one near your address as soon as you arrive. In the Netherlands almost nothing happens medically until your huisarts refers you.", tier: 1 },
    { id: "nl.emergency.voel-me-niet-goed", situation: "emergency", text: "Ik voel me niet goed", meaning: "I don't feel well", say: "ik vool me neet khoot", note: null, tier: 1 },
    { id: "nl.emergency.spoedeisende-hulp", situation: "emergency", text: "Spoedeisende hulp", meaning: "A&E", say: "spoot-EY-sen-de hulp", note: "112 is the emergency number.", tier: 1 },
  ],
};
