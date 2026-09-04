import { DanceGlossary } from '../types';

export const DEFAULT_GLOSSARIES: DanceGlossary[] = [
  {
    id: 'zouk',
    name: 'Brazilian Zouk',
    isSystem: true,
    terms: [
      {
        canonicalTerm: "Básico Frente e Trás",
        variants: ["Básico adelante y atrás", "Basic Step Forward/Back"],
        category: "foundation"
      },
      {
        canonicalTerm: "Lateral",
        variants: ["Side Step", "Lateral"],
        category: "foundation"
      },
      {
        canonicalTerm: "Abertura",
        variants: ["Apertura", "Opening"],
        category: "foundation"
      },
      {
        canonicalTerm: "Viradinha",
        variants: ["Viradita", "Little Turn", "Small Turn"],
        category: "turns"
      },
      {
        canonicalTerm: "Elástico",
        variants: ["Elastic", "Rubber Band"],
        category: "mechanics"
      },
      {
        canonicalTerm: "Balanço",
        variants: ["Balanceo", "Rock Step", "Sway"],
        category: "mechanics"
      },
      {
        canonicalTerm: "Frango Assado",
        variants: ["Pollo Asado", "Rotisserie", "Roasted Chicken"],
        category: "fun"
      },
      {
        canonicalTerm: "Caminhada",
        variants: ["Caminata", "Walking"],
        category: "foundation"
      },
      {
        canonicalTerm: "Pulo do Gato",
        variants: ["Salto del Gato", "Cat's Jump"],
        category: "tricks"
      },
      {
        canonicalTerm: "Preparação",
        variants: ["Preparación", "Preparation"],
        category: "foundation"
      },
      {
        canonicalTerm: "Eixo",
        variants: ["Eje", "Axis"],
        category: "mechanics"
      },
      {
        canonicalTerm: "Transferência de Peso",
        variants: ["Transferencia de peso", "Weight Transfer"],
        category: "mechanics"
      },
      {
        canonicalTerm: "Soltinho",
        variants: [],
        category: "foundation"
      },
      {
        canonicalTerm: "Bônus",
        variants: ["Boom-mer-ang"],
        category: "turns"
      },
      {
        canonicalTerm: "Io-Iô",
        variants: ["Yo-Yo"],
        category: "turns"
      },
      {
        canonicalTerm: "Chicote",
        variants: ["Whip"],
        category: "head"
      },
      {
        canonicalTerm: "Bate-Cabelo",
        variants: ["Hair Whip"],
        category: "head"
      },
      {
        canonicalTerm: "Boneca",
        variants: ["Doll"],
        category: "head"
      },
      {
        canonicalTerm: "Bamboleio",
        variants: ["Sway", "Hula-Hoop Motion"],
        category: "body"
      },
      {
        canonicalTerm: "Carretel",
        variants: ["Spool"],
        category: "turns"
      },
      {
        canonicalTerm: "Circular",
        variants: [],
        category: "head"
      },
      {
        canonicalTerm: "Raul",
        variants: [],
        category: "advanced"
      },
      {
        canonicalTerm: "Torta",
        variants: ["Cake"],
        category: "advanced"
      },
      {
        canonicalTerm: "Contrapeso",
        variants: ["Counterbalance"],
        category: "advanced"
      },
      {
        canonicalTerm: "Cambra",
        variants: ["Cambré", "Backbend", "Arch"],
        category: "advanced"
      },
      {
        canonicalTerm: "Boom-chick-chick",
        variants: ["Tum-chi-chi", "Tum-tá-tá", "Bum-chi-chi"],
        category: "counting"
      }
    ]
  },
  {
    id: 'salsa',
    name: 'Salsa',
    isSystem: true,
    terms: [
      {
        canonicalTerm: "Basic Step",
        variants: ["Paso Básico", "Basic step"],
        category: "foundation"
      },
      {
        canonicalTerm: "Cross Body Lead",
        variants: ["CBL", "Cross-body lead", "Paséala"],
        category: "foundation"
      },
      {
        canonicalTerm: "Dile Que No",
        variants: ["Dile que no", "DQN", "Tell her no"],
        category: "foundation"
      },
      {
        canonicalTerm: "Enchufla",
        variants: ["Enchufe", "Underarm turn"],
        category: "turns"
      },
      {
        canonicalTerm: "La Copa",
        variants: ["Copa", "Copa step", "In and Out"],
        category: "turns"
      },
      {
        canonicalTerm: "Suzie Q",
        variants: ["Susie Q", "Suzie-Q"],
        category: "footwork"
      },
      {
        canonicalTerm: "Salsa Shines",
        variants: ["Footwork shines", "Shines"],
        category: "footwork"
      },
      {
        canonicalTerm: "Open Break",
        variants: ["Guapea", "Basic open"],
        category: "foundation"
      },
      {
        canonicalTerm: "Inside Turn",
        variants: ["Inside spin", "Vuelta izquierda"],
        category: "turns"
      },
      {
        canonicalTerm: "Outside Turn",
        variants: ["Outside spin", "Vuelta derecha"],
        category: "turns"
      },
      {
        canonicalTerm: "Setenta",
        variants: ["70", "Seventy"],
        category: "turns"
      },
      {
        canonicalTerm: "Sombrero",
        variants: ["Hat step"],
        category: "turns"
      },
      {
        canonicalTerm: "Vacilala",
        variants: ["Vacila", "Vacílara"],
        category: "turns"
      },
      {
        canonicalTerm: "Dile Que Si",
        variants: ["Dile que sí"],
        category: "foundation"
      },
      {
        canonicalTerm: "Hammerlock",
        variants: ["Right arm lock", "Left arm lock"],
        category: "mechanics"
      },
      {
        canonicalTerm: "Syncopated Footwork",
        variants: ["Cha-cha step", "Quick steps"],
        category: "footwork"
      },
      {
        canonicalTerm: "Double Turn",
        variants: ["Double spin", "Dos giros"],
        category: "turns"
      },
      {
        canonicalTerm: "Lead and Follow",
        variants: ["Connection", "Frame"],
        category: "mechanics"
      },
      {
        canonicalTerm: "Cross Body Lead with Turn",
        variants: ["CBL with turn", "Cross body lead turn"],
        category: "turns"
      },
      {
        canonicalTerm: "Titanic",
        variants: ["Titanic position", "Titanic hold"],
        category: "mechanics"
      },
      {
        canonicalTerm: "Clave Timing",
        variants: ["Son clave", "Rumba clave", "2-3 clave", "3-2 clave"],
        category: "timing"
      },
      {
        canonicalTerm: "On1 Timing",
        variants: ["L.A. style", "Salsa on 1"],
        category: "timing"
      },
      {
        canonicalTerm: "On2 Timing",
        variants: ["New York style", "Mambo style", "Salsa on 2"],
        category: "timing"
      }
    ]
  },
  {
    id: 'bachata',
    name: 'Bachata',
    isSystem: true,
    terms: [
      {
        canonicalTerm: "Basic Step",
        variants: ["Side to side basic", "Bachata basic"],
        category: "foundation"
      },
      {
        canonicalTerm: "Box Step",
        variants: ["Bachata box step", "Cuadrado"],
        category: "foundation"
      },
      {
        canonicalTerm: "Media Vuelta",
        variants: ["Half turn", "Media vuelta"],
        category: "turns"
      },
      {
        canonicalTerm: "Sensual Style",
        variants: ["Bachata sensual", "Sensual style"],
        category: "style"
      },
      {
        canonicalTerm: "Dominican Style",
        variants: ["Bachata dominicana", "Traditional bachata"],
        category: "style"
      },
      {
        canonicalTerm: "Hip Roll",
        variants: ["Hip rolls", "Hip circle"],
        category: "body"
      },
      {
        canonicalTerm: "Head Roll",
        variants: ["Head rolls", "Head circle", "Cabeceo"],
        category: "body"
      },
      {
        canonicalTerm: "Shadow Position",
        variants: ["Shadow step", "In-shadow", "Sombra"],
        category: "foundation"
      },
      {
        canonicalTerm: "Body Wave",
        variants: ["Bodywave", "Onda"],
        category: "body"
      },
      {
        canonicalTerm: "Madrid Step",
        variants: ["Paso Madrid", "Madrid style basic", "Diagonal"],
        category: "foundation"
      },
      {
        canonicalTerm: "Slide Step",
        variants: ["Slide", "Drag step"],
        category: "foundation"
      },
      {
        canonicalTerm: "Double Turn",
        variants: ["Double spin", "Giro doble"],
        category: "turns"
      },
      {
        canonicalTerm: "Cradle Position",
        variants: ["Cradle wrap", "Abrazo de cuna"],
        category: "foundation"
      },
      {
        canonicalTerm: "Syncopated Step",
        variants: ["Syncopation", "Triple step", "Cha-cha basic"],
        category: "footwork"
      },
      {
        canonicalTerm: "Lateral Wave",
        variants: ["Lateral body wave", "Side wave"],
        category: "body"
      },
      {
        canonicalTerm: "Reverse Wave",
        variants: ["Bottom up wave", "Ondulación inversa"],
        category: "body"
      },
      {
        canonicalTerm: "Hammerlock Wrap",
        variants: ["Bachata wrap", "Arm lock"],
        category: "mechanics"
      },
      {
        canonicalTerm: "Preparation Step",
        variants: ["Prep step", "Push step"],
        category: "mechanics"
      },
      {
        canonicalTerm: "Cambre",
        variants: ["Cambré", "Backbend", "Arch"],
        category: "body"
      },
      {
        canonicalTerm: "Pasada",
        variants: ["Passing step", "Footwork crossing"],
        category: "foundation"
      },
      {
        canonicalTerm: "Syncopated Chasse",
        variants: ["Chasse", "Syncopated lock step"],
        category: "footwork"
      },
      {
        canonicalTerm: "Hip Tap",
        variants: ["Tap on 4", "Tap on 8"],
        category: "footwork"
      }
    ]
  },
  {
    id: 'kizomba',
    name: 'Kizomba',
    isSystem: true,
    terms: [
      {
        canonicalTerm: "Passada",
        variants: ["Kizomba walk", "Basic walk", "Step-walk"],
        category: "foundation"
      },
      {
        canonicalTerm: "Saida Homem",
        variants: ["Men's exit", "Saida masculina"],
        category: "foundation"
      },
      {
        canonicalTerm: "Saida Mulher",
        variants: ["Women's exit", "Saida feminina"],
        category: "foundation"
      },
      {
        canonicalTerm: "Retrocesso",
        variants: ["Step back", "Retrocesso step"],
        category: "foundation"
      },
      {
        canonicalTerm: "Virgula",
        variants: ["Comma step", "Virgula step"],
        category: "turns"
      },
      {
        canonicalTerm: "Tarraxinha",
        variants: ["Tarraxa", "Tarraxinha body movement", "Hip isolation"],
        category: "body"
      },
      {
        canonicalTerm: "Ginga",
        variants: ["Kizomba hip styling", "Kizomba sway", "Hip movement"],
        category: "body"
      },
      {
        canonicalTerm: "Estrela",
        variants: ["Star step", "Star pattern"],
        category: "foundation"
      },
      {
        canonicalTerm: "Quarter Turn",
        variants: ["Giro 90", "Basic quarter turn"],
        category: "turns"
      },
      {
        canonicalTerm: "Block Step",
        variants: ["Stop", "Bloqueio", "Contra-tempo block"],
        category: "mechanics"
      },
      {
        canonicalTerm: "Corridinha",
        variants: ["Little run", "Kizomba run"],
        category: "footwork"
      },
      {
        canonicalTerm: "Pivot Turn",
        variants: ["Pivot spin"],
        category: "turns"
      },
      {
        canonicalTerm: "Kizomba Syncopation",
        variants: ["Cha-cha step", "Syncopated change"],
        category: "footwork"
      },
      {
        canonicalTerm: "Caminhada",
        variants: ["Slow walk", "Pasada kizomba"],
        category: "foundation"
      },
      {
        canonicalTerm: "Close Embrace",
        variants: ["Abrazo cerrado", "Kizomba connection"],
        category: "mechanics"
      },
      {
        canonicalTerm: "Ponto de Pivô",
        variants: ["Pivot point"],
        category: "mechanics"
      },
      {
        canonicalTerm: "Balance",
        variants: ["Rocking step", "Balancê"],
        category: "foundation"
      },
      {
        canonicalTerm: "Retrocesso com Giro",
        variants: ["Backwards walk with turn"],
        category: "turns"
      },
      {
        canonicalTerm: "Tarraxa no Chão",
        variants: ["Grounded tarraxa"],
        category: "body"
      },
      {
        canonicalTerm: "Double Saida",
        variants: ["Continuous exits"],
        category: "foundation"
      },
      {
        canonicalTerm: "Semba Walk",
        variants: ["Semba pasada", "Playful walk"],
        category: "style"
      }
    ]
  },
  {
    id: 'westcoastswing',
    name: 'West Coast Swing',
    isSystem: true,
    terms: [
      { canonicalTerm: "Sugar Push", variants: ["Push Break", "6-count push"], category: "foundation" },
      { canonicalTerm: "Left Side Pass", variants: ["Side Pass", "Underarm left pass"], category: "foundation" },
      { canonicalTerm: "Underarm Turn", variants: ["Right Side Pass", "Underarm pass"], category: "turns" },
      { canonicalTerm: "Whip", variants: ["Basic Whip", "8-count whip"], category: "foundation" },
      { canonicalTerm: "Anchor Step", variants: ["Anchor", "Slot anchor"], category: "mechanics" },
      { canonicalTerm: "Starter Step", variants: ["Starter", "Entry step"], category: "foundation" },
      { canonicalTerm: "Tuck Turn", variants: ["Sugar Tuck", "Tuck pass"], category: "turns" },
      { canonicalTerm: "Inside Roll", variants: ["Inside turn"], category: "turns" },
      { canonicalTerm: "Outside Roll", variants: ["Outside turn"], category: "turns" },
      { canonicalTerm: "Compression", variants: ["Compress", "Spring connection"], category: "mechanics" },
      { canonicalTerm: "Leverage", variants: ["Tension", "Away connection"], category: "mechanics" },
      { canonicalTerm: "The Slot", variants: ["Slot line", "Slotted track"], category: "mechanics" },
      { canonicalTerm: "Triple Step", variants: ["Triple", "Chassé"], category: "footwork" }
    ]
  },
  {
    id: 'tango',
    name: 'Argentine Tango',
    isSystem: true,
    terms: [
      { canonicalTerm: "Caminata", variants: ["Tango walk", "Walking"], category: "foundation" },
      { canonicalTerm: "Salida Básica", variants: ["Basic 8-count", "Salida"], category: "foundation" },
      { canonicalTerm: "Cruzada", variants: ["Cross", "Cross step"], category: "foundation" },
      { canonicalTerm: "Ocho Adelante", variants: ["Front Ocho", "Forward Ocho"], category: "turns" },
      { canonicalTerm: "Ocho Atrás", variants: ["Back Ocho", "Backward Ocho"], category: "turns" },
      { canonicalTerm: "Giro", variants: ["Turn", "Grapevine turn"], category: "turns" },
      { canonicalTerm: "Molinete", variants: ["Windmill step", "Grapevine"], category: "footwork" },
      { canonicalTerm: "Boleo", variants: ["Voleo", "Whip kick"], category: "tricks" },
      { canonicalTerm: "Gancho", variants: ["Hook"], category: "tricks" },
      { canonicalTerm: "Sacada", variants: ["Displacement"], category: "mechanics" },
      { canonicalTerm: "Parada", variants: ["Stop", "Block"], category: "mechanics" },
      { canonicalTerm: "Barrida", variants: ["Sweep", "Drag"], category: "footwork" },
      { canonicalTerm: "Abrazo", variants: ["Embrace", "Close embrace", "Open embrace"], category: "mechanics" },
      { canonicalTerm: "Disociación", variants: ["Dissociation", "Torso twist"], category: "mechanics" }
    ]
  },
  {
    id: 'lindyhop',
    name: 'Lindy Hop',
    isSystem: true,
    terms: [
      { canonicalTerm: "Swingout", variants: ["Swing out", "8-count swingout"], category: "foundation" },
      { canonicalTerm: "Lindy Circle", variants: ["Circle"], category: "foundation" },
      { canonicalTerm: "Charleston", variants: ["Basic Charleston", "20s Charleston"], category: "foundation" },
      { canonicalTerm: "Side by Side Charleston", variants: ["Side by side"], category: "footwork" },
      { canonicalTerm: "Tandem Charleston", variants: ["Shadow Charleston"], category: "footwork" },
      { canonicalTerm: "Promenade", variants: ["Promenade walk"], category: "foundation" },
      { canonicalTerm: "Send Out", variants: ["Sendout"], category: "turns" },
      { canonicalTerm: "Texas Tommy", variants: ["Behind the back pass"], category: "turns" },
      { canonicalTerm: "Triple Step", variants: ["Triple footwork"], category: "footwork" },
      { canonicalTerm: "Rock Step", variants: ["Rock-step"], category: "mechanics" }
    ]
  },
  {
    id: 'contemporary',
    name: 'Contemporary',
    isSystem: true,
    terms: [
      { canonicalTerm: "Contraction", variants: ["Center contraction"], category: "mechanics" },
      { canonicalTerm: "Release", variants: ["Spinal release"], category: "mechanics" },
      { canonicalTerm: "Fall and Recovery", variants: ["Drop and recover"], category: "foundation" },
      { canonicalTerm: "Spiral", variants: ["Torso spiral"], category: "mechanics" },
      { canonicalTerm: "Floor Work", variants: ["Floorwork", "Floor transitions"], category: "foundation" },
      { canonicalTerm: "Suspension", variants: ["Suspend", "Breath suspension"], category: "mechanics" },
      { canonicalTerm: "Tilt", variants: ["Tilt jump", "Side tilt"], category: "foundation" },
      { canonicalTerm: "Arabesque", variants: ["Arabesque line"], category: "foundation" },
      { canonicalTerm: "Développé", variants: ["Developpe leg extension"], category: "foundation" },
      { canonicalTerm: "Grand Jeté", variants: ["Grand jete leap"], category: "tricks" },
      { canonicalTerm: "Pirouette", variants: ["Pirouette turn"], category: "turns" }
    ]
  }
];
