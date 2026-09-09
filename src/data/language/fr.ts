import type { PhrasePack } from "@/domain/language";

/**
 * ============================================================================
 * FRENCH
 * ----------------------------------------------------------------------------
 * The respellings here are rougher than the Spanish ones and that is honest
 * rather than lazy: French has nasal vowels and a u that English does not
 * have, and "on" written as "ohn" is already a compromise. Where the gap is
 * too wide the phrase carries no respelling.
 *
 * One thing worth more than any phrase: in France, walking into a shop without
 * saying "bonjour" first is read as rudeness, and the same request goes very
 * differently once you have. It is the highest-return word in the pack.
 * ============================================================================
 */

export const french: PhrasePack = {
  code: "fr",
  endonym: "Français",
  name: "French",
  speechTag: "fr-FR",
  coverage: "core",
  phrases: [
    /* --- first words ---------------------------------------------------- */
    { id: "fr.first-words.bonjour", situation: "first-words", text: "Bonjour", meaning: "Hello", say: "bohn-ZHOOR", note: "Say it on entering ANY shop, before anything else. Skipping it is the most common mistake a newcomer makes.", tier: 1 },
    { id: "fr.first-words.merci", situation: "first-words", text: "Merci", meaning: "Thank you", say: "mair-SEE", note: null, tier: 1 },
    { id: "fr.first-words.sil-vous-plait", situation: "first-words", text: "S'il vous plaît", meaning: "Please", say: "seel voo PLEH", note: null, tier: 1 },
    { id: "fr.first-words.excusez-moi", situation: "first-words", text: "Excusez-moi", meaning: "Excuse me", say: "eks-kew-zay MWA", note: null, tier: 1 },
    { id: "fr.first-words.je-ne-comprends-pas", situation: "first-words", text: "Je ne comprends pas", meaning: "I don't understand", say: "zhuh nuh kom-PRAHN pa", note: null, tier: 1 },
    { id: "fr.first-words.parlez-anglais", situation: "first-words", text: "Parlez-vous anglais ?", meaning: "Do you speak English?", say: "par-lay VOO ahn-GLEH", note: "After bonjour, never before it.", tier: 1 },
    { id: "fr.first-words.au-revoir", situation: "first-words", text: "Au revoir", meaning: "Goodbye", say: "oh ruh-VWAR", note: "Said on leaving a shop, the same way bonjour is said on entering.", tier: 1 },

    /* --- getting around --------------------------------------------------- */
    { id: "fr.getting-around.ou-est-la-gare", situation: "getting-around", text: "Où est la gare ?", meaning: "Where is the station?", say: "oo eh la GAR", note: null, tier: 1 },
    { id: "fr.getting-around.un-billet", situation: "getting-around", text: "Un billet, s'il vous plaît", meaning: "One ticket, please", say: "uhn bee-YEH", note: null, tier: 1 },
    { id: "fr.getting-around.quel-quai", situation: "getting-around", text: "Quel quai ?", meaning: "Which platform?", say: "kel KAY", note: null, tier: 2 },
    { id: "fr.getting-around.ca-va-a", situation: "getting-around", text: "Ça va à ... ?", meaning: "Does this go to...?", say: "sa va a", note: null, tier: 1 },
    { id: "fr.getting-around.navigo", situation: "getting-around", text: "Le passe Navigo", meaning: "The Paris travel pass", say: "luh pas na-vee-GOH", note: "Under 26 there is a discounted weekend and holiday rate. Ask at the counter rather than the machine.", tier: 2 },

    /* --- groceries ------------------------------------------------------- */
    { id: "fr.groceries.combien", situation: "groceries", text: "Ça coûte combien ?", meaning: "How much is it?", say: "sa koot kom-BYEN", note: null, tier: 1 },
    { id: "fr.groceries.ou-se-trouve", situation: "groceries", text: "Où se trouve ... ?", meaning: "Where is...?", say: "oo suh TROOV", note: null, tier: 1 },
    { id: "fr.groceries.avez-vous", situation: "groceries", text: "Avez-vous ... ?", meaning: "Do you have...?", say: "a-vay VOO", note: null, tier: 1 },
    { id: "fr.groceries.un-sac", situation: "groceries", text: "Un sac, s'il vous plaît", meaning: "A bag, please", say: "uhn sak", note: null, tier: 2 },
    { id: "fr.groceries.cest-tout", situation: "groceries", text: "C'est tout, merci", meaning: "That's everything, thanks", say: "seh TOO mair-SEE", note: null, tier: 1 },

    /* --- eating out ------------------------------------------------------ */
    { id: "fr.eating-out.une-table", situation: "eating-out", text: "Une table pour deux", meaning: "A table for two", say: "ewn TA-bluh poor DUH", note: null, tier: 1 },
    { id: "fr.eating-out.la-carte", situation: "eating-out", text: "La carte, s'il vous plaît", meaning: "The menu, please", say: "la KART", note: "La carte is the full menu. Le menu is a fixed-price set of courses.", tier: 1 },
    { id: "fr.eating-out.formule-midi", situation: "eating-out", text: "La formule du midi", meaning: "The lunch deal", say: "la for-MEWL dew mee-DEE", note: "Weekday lunch at a fixed price, usually two courses. Far cheaper than the same food in the evening.", tier: 1 },
    { id: "fr.eating-out.je-voudrais", situation: "eating-out", text: "Je voudrais ...", meaning: "I would like ...", say: "zhuh voo-DREH", note: null, tier: 1 },
    { id: "fr.eating-out.allergique", situation: "eating-out", text: "Je suis allergique à ...", meaning: "I'm allergic to ...", say: "zhuh swee a-lair-ZHEEK a", note: null, tier: 1 },
    { id: "fr.eating-out.laddition", situation: "eating-out", text: "L'addition, s'il vous plaît", meaning: "The bill, please", say: "la-dee-SYOHN", note: "It will not come until you ask.", tier: 1 },
    { id: "fr.eating-out.une-carafe-deau", situation: "eating-out", text: "Une carafe d'eau", meaning: "A jug of tap water", say: "ewn ka-RAF DOH", note: "Free, and restaurants must provide it. Ask for this rather than bottled.", tier: 1 },

    /* --- money ----------------------------------------------------------- */
    { id: "fr.money.par-carte", situation: "money", text: "Je peux payer par carte ?", meaning: "Can I pay by card?", say: "zhuh puh pay-YAY par KART", note: "Small places sometimes have a minimum of around ten euros.", tier: 1 },
    { id: "fr.money.tarif-etudiant", situation: "money", text: "Il y a un tarif étudiant ?", meaning: "Is there a student rate?", say: "eel ya uhn ta-REEF ay-tew-DYAHN", note: "Under 26 gets you into most national museums free. Carry ID.", tier: 1 },
    { id: "fr.money.la-caution", situation: "money", text: "La caution", meaning: "The deposit", say: "la koh-SYOHN", note: null, tier: 1 },
    { id: "fr.money.un-recu", situation: "money", text: "Un reçu, s'il vous plaît", meaning: "A receipt, please", say: "uhn ruh-SEW", note: null, tier: 2 },

    /* --- housing --------------------------------------------------------- */
    { id: "fr.housing.le-loyer", situation: "housing", text: "Le loyer", meaning: "The rent", say: "luh lwa-YAY", note: null, tier: 1 },
    { id: "fr.housing.charges-comprises", situation: "housing", text: "Charges comprises ?", meaning: "Are bills included?", say: "SHARZH kom-PREEZ", note: "A listing marked CC includes them; HC does not. It changes the real price considerably.", tier: 1 },
    { id: "fr.housing.le-garant", situation: "housing", text: "Le garant", meaning: "The guarantor", say: "luh ga-RAHN", note: "French landlords usually require one. Visale is a free state guarantee scheme for students who do not have a French guarantor.", tier: 1 },
    { id: "fr.housing.letat-des-lieux", situation: "housing", text: "L'état des lieux", meaning: "The inventory check", say: "lay-TA day LYUH", note: "Photograph everything on the day you move in. It is what your deposit is judged against.", tier: 2 },
    { id: "fr.housing.la-caf", situation: "housing", text: "La CAF", meaning: "The housing benefit office", say: "la kaf", note: "International students in France can often claim a monthly housing allowance. Apply as soon as you have a lease.", tier: 1 },

    /* --- university ------------------------------------------------------ */
    { id: "fr.university.inscription", situation: "university", text: "L'inscription", meaning: "Enrolment", say: "lan-skreep-SYOHN", note: null, tier: 1 },
    { id: "fr.university.le-crous", situation: "university", text: "Le CROUS", meaning: "Student services", say: "luh kroos", note: "Runs the halls and the canteens. The restaurant universitaire serves a full meal for a few euros.", tier: 1 },
    { id: "fr.university.la-bu", situation: "university", text: "La BU", meaning: "The university library", say: "la bay-EW", note: "Short for bibliothèque universitaire.", tier: 1 },
    { id: "fr.university.la-date-limite", situation: "university", text: "C'est pour quand ?", meaning: "When is it due?", say: "seh poor KAHN", note: null, tier: 2 },

    /* --- meeting people -------------------------------------------------- */
    { id: "fr.meeting-people.comment-tu-tappelles", situation: "meeting-people", text: "Comment tu t'appelles ?", meaning: "What's your name?", say: "ko-MAHN tew ta-PEL", note: null, tier: 1 },
    { id: "fr.meeting-people.je-mappelle", situation: "meeting-people", text: "Je m'appelle ...", meaning: "My name is ...", say: "zhuh ma-PEL", note: null, tier: 1 },
    { id: "fr.meeting-people.tu-viens-dou", situation: "meeting-people", text: "Tu viens d'où ?", meaning: "Where are you from?", say: "tew vyen DOO", note: null, tier: 1 },
    { id: "fr.meeting-people.ca-te-dit", situation: "meeting-people", text: "Ça te dit ?", meaning: "Fancy it?", say: "sa tuh DEE", note: "How an invitation is actually offered.", tier: 2 },
    { id: "fr.meeting-people.on-boit-un-verre", situation: "meeting-people", text: "On boit un verre ?", meaning: "Shall we get a drink?", say: "ohn bwa uhn VAIR", note: null, tier: 2 },

    /* --- work ------------------------------------------------------------ */
    { id: "fr.work.je-cherche-du-travail", situation: "work", text: "Je cherche du travail", meaning: "I'm looking for work", say: "zhuh SHAIRSH dew tra-VYE", note: null, tier: 1 },
    { id: "fr.work.vous-recrutez", situation: "work", text: "Vous recrutez ?", meaning: "Are you hiring?", say: "voo ruh-krew-TAY", note: null, tier: 1 },
    { id: "fr.work.les-horaires", situation: "work", text: "Quels sont les horaires ?", meaning: "What are the hours?", say: "kel sohn lay zo-RAIR", note: null, tier: 1 },
    { id: "fr.work.combien-paye", situation: "work", text: "C'est payé combien ?", meaning: "What does it pay?", say: "seh pay-YAY kom-BYEN", note: null, tier: 1 },

    /* --- emergency -------------------------------------------------------- */
    { id: "fr.emergency.au-secours", situation: "emergency", text: "Au secours !", meaning: "Help!", say: "oh suh-KOOR", note: null, tier: 1 },
    { id: "fr.emergency.la-pharmacie", situation: "emergency", text: "La pharmacie", meaning: "The pharmacy", say: "la far-ma-SEE", note: "Green cross. A pharmacist will advise you and can hand over a great deal without a prescription.", tier: 1 },
    { id: "fr.emergency.jai-besoin-dun-medecin", situation: "emergency", text: "J'ai besoin d'un médecin", meaning: "I need a doctor", say: "zhay buh-ZWAN duhn mayd-SAN", note: null, tier: 1 },
    { id: "fr.emergency.je-me-sens-mal", situation: "emergency", text: "Je me sens mal", meaning: "I feel ill", say: "zhuh muh sahn MAL", note: null, tier: 1 },
    { id: "fr.emergency.les-urgences", situation: "emergency", text: "Les urgences", meaning: "A&E", say: "lay zewr-ZHAHNS", note: "112 is the emergency number across the EU; 15 reaches the ambulance service in France.", tier: 1 },
  ],
};
