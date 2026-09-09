import type { PhrasePack } from "@/domain/language";

/**
 * ============================================================================
 * PORTUGUESE
 * ----------------------------------------------------------------------------
 * European Portuguese, for Lisbon and Porto. That choice matters more here
 * than in any other pack in this directory: Brazilian Portuguese is the same
 * language written down and a very different one heard, and the respellings
 * below follow the European pronunciation -- unstressed vowels swallowed,
 * final s said as "sh". A student who learns these will be understood in
 * Brazil and will not sound like they learned there.
 *
 * Portuguese has nasal vowels English cannot spell. The ao in "nao" is the
 * clearest example, and the phrases containing it carry no respelling rather
 * than a misleading one.
 * ============================================================================
 */

export const portuguese: PhrasePack = {
  code: "pt",
  endonym: "Português",
  name: "Portuguese",
  speechTag: "pt-PT",
  coverage: "core",
  phrases: [
    /* --- first words ---------------------------------------------------- */
    { id: "pt.first-words.ola", situation: "first-words", text: "Olá", meaning: "Hello", say: "oh-LA", note: null, tier: 1 },
    { id: "pt.first-words.bom-dia", situation: "first-words", text: "Bom dia", meaning: "Good morning", say: "bong DEE-a", note: "Boa tarde from lunch, boa noite after dark.", tier: 1 },
    { id: "pt.first-words.obrigado", situation: "first-words", text: "Obrigado / Obrigada", meaning: "Thank you", say: "o-bree-GA-doo", note: "The ending matches YOUR gender, not theirs: obrigada if you are a woman.", tier: 1 },
    { id: "pt.first-words.por-favor", situation: "first-words", text: "Por favor", meaning: "Please", say: "poor fa-VOR", note: null, tier: 1 },
    { id: "pt.first-words.desculpe", situation: "first-words", text: "Desculpe", meaning: "Excuse me / sorry", say: "desh-KOOL-peh", note: null, tier: 1 },
    { id: "pt.first-words.nao-percebo", situation: "first-words", text: "Não percebo", meaning: "I don't understand", say: null, note: "Perceber, not compreender, is the everyday verb in Portugal.", tier: 1 },
    { id: "pt.first-words.fala-ingles", situation: "first-words", text: "Fala inglês?", meaning: "Do you speak English?", say: "FA-la in-GLESH", note: null, tier: 1 },

    /* --- getting around --------------------------------------------------- */
    { id: "pt.getting-around.onde-e-a-estacao", situation: "getting-around", text: "Onde é a estação?", meaning: "Where is the station?", say: null, note: null, tier: 1 },
    { id: "pt.getting-around.um-bilhete", situation: "getting-around", text: "Um bilhete, por favor", meaning: "One ticket, please", say: "oong beel-YEH-teh", note: null, tier: 1 },
    { id: "pt.getting-around.navegante", situation: "getting-around", text: "O passe Navegante", meaning: "The Lisbon travel pass", say: "oo PA-seh na-veh-GAN-teh", note: "A monthly pass covering metro, bus, tram and train in the Lisbon area, with a reduced student rate.", tier: 1 },
    { id: "pt.getting-around.vai-para", situation: "getting-around", text: "Vai para ...?", meaning: "Does it go to...?", say: "vye PA-ra", note: null, tier: 1 },
    { id: "pt.getting-around.qual-a-linha", situation: "getting-around", text: "Qual é a linha?", meaning: "Which line?", say: "kwal eh a LEEN-ya", note: null, tier: 2 },

    /* --- groceries ------------------------------------------------------- */
    { id: "pt.groceries.quanto-custa", situation: "groceries", text: "Quanto custa?", meaning: "How much is it?", say: "KWAN-too KOOSH-ta", note: null, tier: 1 },
    { id: "pt.groceries.onde-esta", situation: "groceries", text: "Onde está ...?", meaning: "Where is...?", say: "ON-deh shTA", note: null, tier: 1 },
    { id: "pt.groceries.tem", situation: "groceries", text: "Tem ...?", meaning: "Do you have...?", say: "teng", note: null, tier: 1 },
    { id: "pt.groceries.so-isto", situation: "groceries", text: "Só isto, obrigado", meaning: "Just this, thanks", say: "saw EESH-too", note: null, tier: 1 },
    { id: "pt.groceries.cartao-continente", situation: "groceries", text: "Tem cartão?", meaning: "Do you have a loyalty card?", say: null, note: "You will be asked this at every supermarket till. The discounts are real and the card is free.", tier: 1 },

    /* --- eating out ------------------------------------------------------ */
    { id: "pt.eating-out.mesa-para-dois", situation: "eating-out", text: "Uma mesa para dois", meaning: "A table for two", say: "OO-ma MEH-za PA-ra doysh", note: null, tier: 1 },
    { id: "pt.eating-out.a-ementa", situation: "eating-out", text: "A ementa, por favor", meaning: "The menu, please", say: "a ee-MEN-ta", note: null, tier: 1 },
    { id: "pt.eating-out.prato-do-dia", situation: "eating-out", text: "O prato do dia", meaning: "The dish of the day", say: "oo PRA-too doo DEE-a", note: "Lunchtime, often with soup and a drink included, and usually the cheapest full meal available.", tier: 1 },
    { id: "pt.eating-out.couvert", situation: "eating-out", text: "O couvert", meaning: "The bread and starters put on the table", say: "oo koo-VAIR", note: "Not free. Anything you do not want, send back untouched and it will not be charged.", tier: 1 },
    { id: "pt.eating-out.sou-alergico", situation: "eating-out", text: "Sou alérgico a ...", meaning: "I'm allergic to ...", say: "so a-LAIR-zhee-koo a", note: "Alérgica if you are a woman.", tier: 1 },
    { id: "pt.eating-out.a-conta", situation: "eating-out", text: "A conta, por favor", meaning: "The bill, please", say: "a KON-ta", note: null, tier: 1 },

    /* --- money ----------------------------------------------------------- */
    { id: "pt.money.posso-pagar-cartao", situation: "money", text: "Posso pagar com cartão?", meaning: "Can I pay by card?", say: null, note: "Multibanco is the local card network and is accepted everywhere.", tier: 1 },
    { id: "pt.money.desconto-estudante", situation: "money", text: "Há desconto de estudante?", meaning: "Is there a student discount?", say: "a desh-KON-too deh shtoo-DAN-teh", note: null, tier: 1 },
    { id: "pt.money.a-caucao", situation: "money", text: "A caução", meaning: "The deposit", say: null, note: null, tier: 1 },
    { id: "pt.money.o-recibo", situation: "money", text: "O recibo", meaning: "The receipt", say: "oo reh-SEE-boo", note: null, tier: 2 },

    /* --- housing --------------------------------------------------------- */
    { id: "pt.housing.a-renda", situation: "housing", text: "A renda", meaning: "The rent", say: "a REN-da", note: null, tier: 1 },
    { id: "pt.housing.despesas-incluidas", situation: "housing", text: "As despesas estão incluídas?", meaning: "Are bills included?", say: "ash desh-PEH-zash", note: null, tier: 1 },
    { id: "pt.housing.o-contrato", situation: "housing", text: "O contrato", meaning: "The contract", say: "oo kon-TRA-too", note: null, tier: 1 },
    { id: "pt.housing.o-nif", situation: "housing", text: "O NIF", meaning: "The tax number", say: "oo neef", note: "Asked for at almost every till and required for a lease, a phone contract and a bank account. Get one in your first week.", tier: 1 },
    { id: "pt.housing.o-senhorio", situation: "housing", text: "O senhorio", meaning: "The landlord", say: "oo sen-yoo-REE-oo", note: null, tier: 2 },

    /* --- university ------------------------------------------------------ */
    { id: "pt.university.a-matricula", situation: "university", text: "A matrícula", meaning: "Enrolment", say: "a ma-TREE-koo-la", note: null, tier: 1 },
    { id: "pt.university.os-servicos-academicos", situation: "university", text: "Os serviços académicos", meaning: "The admin office", say: "oosh ser-VEE-soosh a-ka-DEH-mee-koosh", note: null, tier: 1 },
    { id: "pt.university.a-cantina", situation: "university", text: "A cantina", meaning: "The university canteen", say: "a kan-TEE-na", note: "A full meal for a few euros with a student card.", tier: 1 },
    { id: "pt.university.a-biblioteca", situation: "university", text: "A biblioteca", meaning: "The library", say: "a bee-blee-oo-TEH-ka", note: null, tier: 1 },

    /* --- meeting people -------------------------------------------------- */
    { id: "pt.meeting-people.como-te-chamas", situation: "meeting-people", text: "Como te chamas?", meaning: "What's your name?", say: "KO-moo teh SHA-mash", note: null, tier: 1 },
    { id: "pt.meeting-people.chamo-me", situation: "meeting-people", text: "Chamo-me ...", meaning: "My name is ...", say: "SHA-moo meh", note: null, tier: 1 },
    { id: "pt.meeting-people.de-onde-es", situation: "meeting-people", text: "De onde és?", meaning: "Where are you from?", say: "deh ON-deh esh", note: null, tier: 1 },
    { id: "pt.meeting-people.vamos-beber", situation: "meeting-people", text: "Vamos beber um copo?", meaning: "Shall we get a drink?", say: "VA-moosh beh-BAIR oong KO-poo", note: null, tier: 2 },
    { id: "pt.meeting-people.ate-logo", situation: "meeting-people", text: "Até logo", meaning: "See you later", say: "a-TEH LO-goo", note: null, tier: 1 },

    /* --- work ------------------------------------------------------------ */
    { id: "pt.work.procuro-trabalho", situation: "work", text: "Procuro trabalho", meaning: "I'm looking for work", say: "proo-KOO-roo tra-BAL-yoo", note: null, tier: 1 },
    { id: "pt.work.estao-a-contratar", situation: "work", text: "Estão a contratar?", meaning: "Are you hiring?", say: null, note: null, tier: 1 },
    { id: "pt.work.qual-e-o-horario", situation: "work", text: "Qual é o horário?", meaning: "What are the hours?", say: "kwal eh oo o-RA-ryoo", note: null, tier: 1 },
    { id: "pt.work.quanto-paga", situation: "work", text: "Quanto paga?", meaning: "What does it pay?", say: "KWAN-too PA-ga", note: null, tier: 1 },

    /* --- emergency -------------------------------------------------------- */
    { id: "pt.emergency.socorro", situation: "emergency", text: "Socorro!", meaning: "Help!", say: "soo-KO-rroo", note: null, tier: 1 },
    { id: "pt.emergency.a-farmacia", situation: "emergency", text: "A farmácia", meaning: "The pharmacy", say: "a far-MA-see-a", note: "Green cross. The rota for the one open at night is posted on the door.", tier: 1 },
    { id: "pt.emergency.preciso-de-um-medico", situation: "emergency", text: "Preciso de um médico", meaning: "I need a doctor", say: "preh-SEE-zoo deh oong MEH-dee-koo", note: null, tier: 1 },
    { id: "pt.emergency.sinto-me-mal", situation: "emergency", text: "Sinto-me mal", meaning: "I feel ill", say: "SEEN-too meh mal", note: null, tier: 1 },
    { id: "pt.emergency.as-urgencias", situation: "emergency", text: "As urgências", meaning: "A&E", say: "ash oor-ZHEN-see-ash", note: "112 is the emergency number.", tier: 1 },
  ],
};
