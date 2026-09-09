import type { PhrasePack } from "@/domain/language";

/**
 * ============================================================================
 * SPANISH
 * ----------------------------------------------------------------------------
 * Peninsular Spanish, because the cities behind this pack are Madrid and
 * Barcelona. That decision shows up in the respellings: "gracias" is written
 * GRA-thee-as, not GRA-see-as, because that is what a student will hear at a
 * till in Madrid and what they should say back. In Latin America the same word
 * is said with an S and this pack would be mildly wrong -- a real limitation,
 * stated here rather than hidden.
 *
 * The respellings are approximations for an English speaker and nothing more.
 * They are hyphenated by syllable with the stressed one in capitals. Spanish
 * is unusually friendly to this -- the vowels are consistent and there are
 * only five -- which is why every phrase here has one and why other packs in
 * this directory have fewer.
 *
 * A few things in this file are worth more than a translation and carry a
 * note, because knowing the words is not the same as knowing what happens:
 * "menu del dia" is the single biggest lever a student in Spain has on their
 * food budget, and "cana" is what you order if you do not want to be handed a
 * pint you did not want to pay for.
 * ============================================================================
 */

export const spanish: PhrasePack = {
  code: "es",
  endonym: "Español",
  name: "Spanish",
  speechTag: "es-ES",
  coverage: "full",
  phrases: [
    /* --- first words ---------------------------------------------------- */
    { id: "es.first-words.hola", situation: "first-words", text: "Hola", meaning: "Hello", say: "OH-la", note: "Works with anyone, at any hour, in any shop.", tier: 1 },
    { id: "es.first-words.buenos-dias", situation: "first-words", text: "Buenos días", meaning: "Good morning", say: "BWEH-nos DEE-as", note: "Until about two in the afternoon, when lunch starts.", tier: 1 },
    { id: "es.first-words.buenas-tardes", situation: "first-words", text: "Buenas tardes", meaning: "Good afternoon", say: "BWEH-nas TAR-des", note: "From lunch until about nine, when it becomes buenas noches.", tier: 2 },
    { id: "es.first-words.gracias", situation: "first-words", text: "Gracias", meaning: "Thank you", say: "GRA-thee-as", note: "The c is a soft th in Spain. In Latin America it is an s.", tier: 1 },
    { id: "es.first-words.por-favor", situation: "first-words", text: "Por favor", meaning: "Please", say: "por fa-VOR", note: null, tier: 1 },
    { id: "es.first-words.perdona", situation: "first-words", text: "Perdona", meaning: "Excuse me", say: "per-DOH-na", note: "To get someone's attention. Perdone is the formal version.", tier: 1 },
    { id: "es.first-words.no-entiendo", situation: "first-words", text: "No entiendo", meaning: "I don't understand", say: "no en-tee-EN-do", note: "More useful than any other sentence in your first week.", tier: 1 },
    { id: "es.first-words.hablas-ingles", situation: "first-words", text: "¿Hablas inglés?", meaning: "Do you speak English?", say: "AH-blas in-GLES", note: "Ask it in Spanish first. It changes how the answer comes back.", tier: 1 },
    { id: "es.first-words.mas-despacio", situation: "first-words", text: "¿Puedes hablar más despacio?", meaning: "Can you speak more slowly?", say: "PWEH-des a-BLAR mas des-PA-thee-o", note: "Better than nodding. People will slow right down.", tier: 2 },
    { id: "es.first-words.hasta-luego", situation: "first-words", text: "Hasta luego", meaning: "See you later", say: "AS-ta LWEH-go", note: "Said far more than adiós, including to people you will never see again.", tier: 1 },

    /* --- getting around --------------------------------------------------- */
    { id: "es.getting-around.donde-esta", situation: "getting-around", text: "¿Dónde está la estación?", meaning: "Where is the station?", say: "DON-de es-TA la es-ta-thee-ON", note: "Swap la estación for whatever you are looking for.", tier: 1 },
    { id: "es.getting-around.un-billete", situation: "getting-around", text: "Un billete, por favor", meaning: "One ticket, please", say: "oon bee-YEH-te por fa-VOR", note: null, tier: 1 },
    { id: "es.getting-around.este-va-a", situation: "getting-around", text: "¿Este va a...?", meaning: "Does this one go to...?", say: "ES-te va a", note: "Point at the bus or hold up your phone. It works.", tier: 1 },
    { id: "es.getting-around.que-anden", situation: "getting-around", text: "¿Qué andén?", meaning: "Which platform?", say: "keh an-DEN", note: null, tier: 2 },
    { id: "es.getting-around.donde-me-bajo", situation: "getting-around", text: "¿Dónde me bajo?", meaning: "Where do I get off?", say: "DON-de me BA-ho", note: "Ask the driver as you get on and they will usually tell you.", tier: 2 },
    { id: "es.getting-around.cuanto-tarda", situation: "getting-around", text: "¿Cuánto tarda?", meaning: "How long does it take?", say: "KWAN-to TAR-da", note: null, tier: 2 },
    { id: "es.getting-around.abono", situation: "getting-around", text: "El abono de transporte", meaning: "The monthly travel pass", say: "el a-BO-no de trans-POR-te", note: "Under 26 in Madrid, this is around €20 a month for everything. Ask for the abono joven.", tier: 1 },
    { id: "es.getting-around.ultima-hora", situation: "getting-around", text: "¿A qué hora es el último?", meaning: "What time is the last one?", say: "a keh OH-ra es el OOL-tee-mo", note: "The Madrid metro stops at 1:30am. Worth knowing before you need it.", tier: 2 },

    /* --- groceries ------------------------------------------------------- */
    { id: "es.groceries.cuanto-cuesta", situation: "groceries", text: "¿Cuánto cuesta?", meaning: "How much is it?", say: "KWAN-to KWES-ta", note: "The one you will use most. Point and say it.", tier: 1 },
    { id: "es.groceries.donde-esta", situation: "groceries", text: "¿Dónde está...?", meaning: "Where is...?", say: "DON-de es-TA", note: "Finish it with whatever you are hunting for, or just show a photo.", tier: 1 },
    { id: "es.groceries.tienen", situation: "groceries", text: "¿Tienen...?", meaning: "Do you have...?", say: "tee-EH-nen", note: null, tier: 1 },
    { id: "es.groceries.una-bolsa", situation: "groceries", text: "Una bolsa, por favor", meaning: "A bag, please", say: "OO-na BOL-sa por fa-VOR", note: "Bags cost a few cents and are not offered. Bring your own.", tier: 2 },
    { id: "es.groceries.algo-mas", situation: "groceries", text: "¿Algo más?", meaning: "Anything else?", say: "AL-go mas", note: "You will be ASKED this. Answer: nada más, gracias.", tier: 1 },
    { id: "es.groceries.nada-mas", situation: "groceries", text: "Nada más, gracias", meaning: "That's everything, thanks", say: "NA-da mas GRA-thee-as", note: null, tier: 1 },
    { id: "es.groceries.a-granel", situation: "groceries", text: "¿Puedo comprarlo a granel?", meaning: "Can I buy it loose?", say: "PWEH-do kom-PRAR-lo a gra-NEL", note: "Loose fruit and veg is markedly cheaper than the packed trays.", tier: 3 },
    { id: "es.groceries.caduca", situation: "groceries", text: "¿Cuándo caduca?", meaning: "When does it expire?", say: "KWAN-do ka-DOO-ka", note: "Reduced shelves are marked with a yellow sticker.", tier: 3 },

    /* --- eating out ------------------------------------------------------ */
    { id: "es.eating-out.mesa-para-dos", situation: "eating-out", text: "Una mesa para dos", meaning: "A table for two", say: "OO-na MEH-sa PA-ra dos", note: null, tier: 1 },
    { id: "es.eating-out.la-carta", situation: "eating-out", text: "La carta, por favor", meaning: "The menu, please", say: "la KAR-ta por fa-VOR", note: "La carta is the menu. El menú usually means the set lunch.", tier: 1 },
    { id: "es.eating-out.menu-del-dia", situation: "eating-out", text: "El menú del día", meaning: "The set lunch", say: "el me-NOO del DEE-a", note: "Weekday lunch: starter, main, bread, drink and dessert for one fixed price. The best-value meal in Spain and the reason a student can eat out at all.", tier: 1 },
    { id: "es.eating-out.para-mi", situation: "eating-out", text: "Para mí, ...", meaning: "For me, ...", say: "PA-ra mee", note: "Point at the menu after it. Nobody minds.", tier: 1 },
    { id: "es.eating-out.sin", situation: "eating-out", text: "Sin ...", meaning: "Without ...", say: "seen", note: "Sin cebolla, sin queso, sin gluten.", tier: 2 },
    { id: "es.eating-out.alergico", situation: "eating-out", text: "Soy alérgico a...", meaning: "I'm allergic to...", say: "soy a-LER-hee-ko a", note: "Say alérgica if you are a woman. Restaurants take this seriously and will check.", tier: 1 },
    { id: "es.eating-out.la-cuenta", situation: "eating-out", text: "La cuenta, por favor", meaning: "The bill, please", say: "la KWEN-ta por fa-VOR", note: "It never arrives unasked. You can sit for an hour and nobody will hurry you.", tier: 1 },
    { id: "es.eating-out.una-cana", situation: "eating-out", text: "Una caña", meaning: "A small draught beer", say: "OO-na KA-nya", note: "About 200ml, and usually the cheapest thing on the list. Ask for a cerveza and you may be given a bottle at twice the price.", tier: 1 },
    { id: "es.eating-out.agua-del-grifo", situation: "eating-out", text: "Agua del grifo, por favor", meaning: "Tap water, please", say: "AH-gwa del GREE-fo", note: "Free, and legally required to be offered. Bottled water is not.", tier: 1 },
    { id: "es.eating-out.esta-incluido", situation: "eating-out", text: "¿Está incluido?", meaning: "Is it included?", say: "es-TA een-kloo-EE-do", note: "Worth asking about bread, which is sometimes charged separately.", tier: 2 },

    /* --- money ----------------------------------------------------------- */
    { id: "es.money.pagar-con-tarjeta", situation: "money", text: "¿Puedo pagar con tarjeta?", meaning: "Can I pay by card?", say: "PWEH-do pa-GAR kon tar-HEH-ta", note: "Nearly always yes, but small bars sometimes have a minimum.", tier: 1 },
    { id: "es.money.en-efectivo", situation: "money", text: "En efectivo", meaning: "In cash", say: "en e-fek-TEE-vo", note: null, tier: 1 },
    { id: "es.money.descuento-estudiante", situation: "money", text: "¿Hay descuento para estudiantes?", meaning: "Is there a student discount?", say: "ai des-KWEN-to PA-ra es-too-dee-AN-tes", note: "Ask everywhere: museums, cinemas, gyms, barbers. It is often unadvertised.", tier: 1 },
    { id: "es.money.hay-comision", situation: "money", text: "¿Hay comisión?", meaning: "Is there a fee?", say: "ai ko-mee-see-ON", note: "Ask before using a cash machine that offers to convert the currency for you. Always decline that.", tier: 2 },
    { id: "es.money.un-recibo", situation: "money", text: "¿Me da un recibo?", meaning: "Can I have a receipt?", say: "me da oon re-THEE-bo", note: null, tier: 2 },
    { id: "es.money.iva-incluido", situation: "money", text: "¿El IVA está incluido?", meaning: "Is VAT included?", say: "el EE-va es-TA een-kloo-EE-do", note: "In shops and restaurants it always is. In quotes for work, often not.", tier: 3 },

    /* --- housing --------------------------------------------------------- */
    { id: "es.housing.alquiler", situation: "housing", text: "El alquiler", meaning: "The rent", say: "el al-kee-LER", note: null, tier: 1 },
    { id: "es.housing.fianza", situation: "housing", text: "La fianza", meaning: "The deposit", say: "la fee-AN-tha", note: "Usually one or two months. Ask in writing how and when it comes back.", tier: 1 },
    { id: "es.housing.gastos-incluidos", situation: "housing", text: "¿Están incluidos los gastos?", meaning: "Are bills included?", say: "es-TAN een-kloo-EE-dos los GAS-tos", note: "Gastos means water, electricity, gas and internet. Ask which ones.", tier: 1 },
    { id: "es.housing.contrato", situation: "housing", text: "El contrato", meaning: "The contract", say: "el kon-TRA-to", note: "Never pay a deposit before you have seen one.", tier: 1 },
    { id: "es.housing.casero", situation: "housing", text: "El casero / la casera", meaning: "The landlord", say: "el ka-SEH-ro", note: null, tier: 2 },
    { id: "es.housing.llaves", situation: "housing", text: "Las llaves", meaning: "The keys", say: "las YA-bes", note: null, tier: 2 },
    { id: "es.housing.no-funciona", situation: "housing", text: "No funciona el ...", meaning: "The ... isn't working", say: "no foon-thee-O-na el", note: "La caldera is the boiler, la calefacción the heating, el agua caliente the hot water.", tier: 2 },
    { id: "es.housing.empadronamiento", situation: "housing", text: "El empadronamiento", meaning: "Registering at your address", say: "el em-pa-dro-na-mee-EN-to", note: "The town hall register. You will be asked for the certificate by banks, the health service and the university.", tier: 2 },

    /* --- university ------------------------------------------------------ */
    { id: "es.university.matricula", situation: "university", text: "La matrícula", meaning: "Enrolment", say: "la ma-TREE-koo-la", note: "Also means the tuition fee itself.", tier: 1 },
    { id: "es.university.secretaria", situation: "university", text: "La secretaría", meaning: "The admin office", say: "la se-kre-ta-REE-a", note: "Where every piece of paperwork ends up. Go in person; email is slower.", tier: 1 },
    { id: "es.university.carne-estudiante", situation: "university", text: "El carné de estudiante", meaning: "The student card", say: "el kar-NEH de es-too-dee-AN-te", note: "Carry it. It is what unlocks the discounts.", tier: 1 },
    { id: "es.university.biblioteca", situation: "university", text: "La biblioteca", meaning: "The library", say: "la bee-blee-o-TEH-ka", note: null, tier: 1 },
    { id: "es.university.cuando-entregar", situation: "university", text: "¿Cuándo hay que entregarlo?", meaning: "When is it due?", say: "KWAN-do ai keh en-tre-GAR-lo", note: null, tier: 2 },
    { id: "es.university.en-ingles", situation: "university", text: "¿Puedo hacerlo en inglés?", meaning: "Can I do it in English?", say: "PWEH-do a-THER-lo en in-GLES", note: "Worth asking early rather than at the deadline.", tier: 2 },
    { id: "es.university.convocatoria", situation: "university", text: "La convocatoria", meaning: "The exam sitting", say: "la kon-vo-ka-TO-ree-a", note: "Spanish degrees usually give you two per year. The second is the resit.", tier: 3 },

    /* --- meeting people -------------------------------------------------- */
    { id: "es.meeting-people.como-te-llamas", situation: "meeting-people", text: "¿Cómo te llamas?", meaning: "What's your name?", say: "KO-mo te YA-mas", note: null, tier: 1 },
    { id: "es.meeting-people.me-llamo", situation: "meeting-people", text: "Me llamo ...", meaning: "My name is ...", say: "me YA-mo", note: null, tier: 1 },
    { id: "es.meeting-people.de-donde-eres", situation: "meeting-people", text: "¿De dónde eres?", meaning: "Where are you from?", say: "de DON-de EH-res", note: "The first question anybody will ask you.", tier: 1 },
    { id: "es.meeting-people.encantado", situation: "meeting-people", text: "Encantado / Encantada", meaning: "Nice to meet you", say: "en-kan-TA-do", note: "Encantada if you are a woman.", tier: 1 },
    { id: "es.meeting-people.te-apuntas", situation: "meeting-people", text: "¿Te apuntas?", meaning: "Are you in?", say: "te a-POON-tas", note: "How an invitation is actually made. Much more natural than a formal one.", tier: 2 },
    { id: "es.meeting-people.quedamos", situation: "meeting-people", text: "¿Quedamos el jueves?", meaning: "Shall we meet on Thursday?", say: "ke-DA-mos el HWEH-bes", note: "Quedar is the verb for making plans and you will hear it constantly.", tier: 2 },
    { id: "es.meeting-people.tomamos-algo", situation: "meeting-people", text: "¿Nos tomamos algo?", meaning: "Shall we get a drink?", say: "nos to-MA-mos AL-go", note: null, tier: 2 },

    /* --- work ------------------------------------------------------------ */
    { id: "es.work.busco-trabajo", situation: "work", text: "Busco trabajo", meaning: "I'm looking for work", say: "BOOS-ko tra-BA-ho", note: null, tier: 1 },
    { id: "es.work.buscando-gente", situation: "work", text: "¿Estáis buscando gente?", meaning: "Are you taking anyone on?", say: "es-TAIS boos-KAN-do HEN-te", note: "Walking in and asking is still how most bar and shop work is found.", tier: 1 },
    { id: "es.work.horario", situation: "work", text: "¿Cuál es el horario?", meaning: "What are the hours?", say: "kwal es el o-RA-ree-o", note: null, tier: 1 },
    { id: "es.work.cuanto-se-paga", situation: "work", text: "¿Cuánto se paga?", meaning: "How much does it pay?", say: "KWAN-to se PA-ga", note: "Ask before you agree to a trial shift.", tier: 1 },
    { id: "es.work.cuando-empezar", situation: "work", text: "¿Cuándo puedo empezar?", meaning: "When can I start?", say: "KWAN-do PWEH-do em-pe-THAR", note: null, tier: 2 },
    { id: "es.work.curriculum", situation: "work", text: "El currículum", meaning: "The CV", say: "el ku-REE-koo-loom", note: "Print a few. Handing one over in person still works.", tier: 2 },
    { id: "es.work.contrato-trabajo", situation: "work", text: "¿Con contrato?", meaning: "With a contract?", say: "kon kon-TRA-to", note: "Work without one leaves you with no hours, no payslip and no recourse. Ask.", tier: 2 },

    /* --- emergency -------------------------------------------------------- */
    { id: "es.emergency.ayuda", situation: "emergency", text: "¡Ayuda!", meaning: "Help!", say: "a-YOO-da", note: null, tier: 1 },
    { id: "es.emergency.farmacia", situation: "emergency", text: "La farmacia", meaning: "The pharmacy", say: "la far-MA-thee-a", note: "Green cross. Pharmacists in Spain give real advice and can hand over a lot without a prescription.", tier: 1 },
    { id: "es.emergency.necesito-medico", situation: "emergency", text: "Necesito un médico", meaning: "I need a doctor", say: "ne-the-SEE-to oon MEH-dee-ko", note: null, tier: 1 },
    { id: "es.emergency.me-encuentro-mal", situation: "emergency", text: "Me encuentro mal", meaning: "I feel ill", say: "me en-KWEN-tro mal", note: null, tier: 1 },
    { id: "es.emergency.me-duele", situation: "emergency", text: "Me duele ...", meaning: "My ... hurts", say: "me DWEH-le", note: "La cabeza the head, el estómago the stomach, la garganta the throat.", tier: 1 },
    { id: "es.emergency.urgencias", situation: "emergency", text: "Urgencias", meaning: "A&E", say: "oor-HEN-thee-as", note: "The word on the hospital sign. 112 is the emergency number across the EU.", tier: 1 },
    { id: "es.emergency.tengo-seguro", situation: "emergency", text: "Tengo seguro médico", meaning: "I have health insurance", say: "TEN-go se-GOO-ro MEH-dee-ko", note: "Carry your European health card or your policy number.", tier: 2 },
    { id: "es.emergency.llame-policia", situation: "emergency", text: "Llame a la policía", meaning: "Call the police", say: "YA-me a la po-lee-THEE-a", note: null, tier: 2 },
  ],
};
