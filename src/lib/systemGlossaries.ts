import { DanceGlossary } from '../types';
import { DEFAULT_GLOSSARIES } from './defaultGlossaries';

// Helper to pull existing terms from the old default glossaries, otherwise empty
const getTerms = (oldId: string) => {
  return DEFAULT_GLOSSARIES.find(g => g.id === oldId)?.terms || [];
};

export const SYSTEM_GLOSSARIES: DanceGlossary[] = [
  { id: 'bachata', name: 'Bachata', isSystem: true, terms: getTerms('bachata') },
  { id: 'salsa', name: 'Salsa', isSystem: true, terms: getTerms('salsa') },
  { id: 'kizomba', name: 'Kizomba', isSystem: true, terms: getTerms('kizomba') },
  { 
    id: 'reggaeton', 
    name: 'Reggaeton', 
    isSystem: true, 
    terms: [
      { canonicalTerm: 'Perreo', variants: ['Perreo intenso', 'Perreo abajo'], category: 'moves' },
      { canonicalTerm: 'Dembow', variants: ['Ritmo dembow', 'Base de dembow'], category: 'rhythm' },
      { canonicalTerm: 'Sandungueo', variants: ['Sandunga'], category: 'moves' },
      { canonicalTerm: 'Rebote', variants: ['Rebote de cadera', 'Bounce'], category: 'foundation' },
      { canonicalTerm: 'Meneo', variants: ['Meneo de cintura'], category: 'moves' },
      { canonicalTerm: 'Despelote', variants: ['Despeloteo'], category: 'styling' },
      { canonicalTerm: 'Paso Básico', variants: ['Basic step', 'Paso de reggaeton'], category: 'foundation' },
      { canonicalTerm: 'Onda', variants: ['Body roll', 'Onda corporal'], category: 'isolation' }
    ] 
  },
  { id: 'brazilian-zouk', name: 'Brazilian Zouk', isSystem: true, terms: getTerms('zouk') },
  { 
    id: 'afro-beats', 
    name: 'Afro Beats', 
    isSystem: true, 
    terms: [
      { canonicalTerm: 'Zanku', variants: ['Zlatan dance'], category: 'footwork' },
      { canonicalTerm: 'Gbese', variants: ['Lift leg'], category: 'footwork' },
      { canonicalTerm: 'Shaku Shaku', variants: ['Shaku'], category: 'foundation' },
      { canonicalTerm: 'Network', variants: ['Network step'], category: 'moves' },
      { canonicalTerm: 'Poco Dance', variants: ['Poco lee dance'], category: 'footwork' },
      { canonicalTerm: 'Kupe', variants: ['Kupe step'], category: 'moves' },
      { canonicalTerm: 'Pilolo', variants: ['Pilolo step'], category: 'footwork' },
      { canonicalTerm: 'Legwork', variants: ['Afro legwork'], category: 'footwork' },
      { canonicalTerm: 'Tesumole', variants: ['Step on devil'], category: 'footwork' }
    ] 
  },
  { 
    id: 'dancehall', 
    name: 'DanceHall', 
    isSystem: true, 
    terms: [
      { canonicalTerm: 'Bogle', variants: ['Mr. Bogle'], category: 'old_school' },
      { canonicalTerm: 'Willie Bounce', variants: ['Elephant Man bounce'], category: 'middle_school' },
      { canonicalTerm: 'Butterfly', variants: ['Butterfly legs'], category: 'foundation' },
      { canonicalTerm: 'Dutty Wine', variants: ['Wine', 'Dutty wine'], category: 'female' },
      { canonicalTerm: 'Gully Creeper', variants: ['Creeper'], category: 'middle_school' },
      { canonicalTerm: 'Nuh Linga', variants: ['No lingering'], category: 'middle_school' },
      { canonicalTerm: 'Signal Di Plane', variants: ['Signal the plane'], category: 'middle_school' },
      { canonicalTerm: 'One Drop', variants: ['Drop'], category: 'rhythm' }
    ] 
  },
  { 
    id: 'hip-hop', 
    name: 'Hip Hop', 
    isSystem: true, 
    terms: [
      { canonicalTerm: 'Bounce', variants: ['Up bounce', 'Down bounce'], category: 'foundation' },
      { canonicalTerm: 'Rock', variants: ['Rocking'], category: 'foundation' },
      { canonicalTerm: 'Popping', variants: ['Pop', 'Hits'], category: 'technique' },
      { canonicalTerm: 'Locking', variants: ['Lock', 'Points'], category: 'technique' },
      { canonicalTerm: 'Wave', variants: ['Body wave', 'Arm wave'], category: 'isolation' },
      { canonicalTerm: 'Top Rock', variants: ['Toprock'], category: 'breaking' },
      { canonicalTerm: 'Six Step', variants: ['6-step'], category: 'floorwork' },
      { canonicalTerm: 'Freeze', variants: ['Baby freeze', 'Chair freeze'], category: 'breaking' },
      { canonicalTerm: 'C-Walk', variants: ['Crip walk'], category: 'footwork' }
    ] 
  },
  { id: 'contemporary-dance', name: 'Contemporary Dance', isSystem: true, terms: getTerms('contemporary') },
  { id: 'tango', name: 'Tango', isSystem: true, terms: getTerms('tango') },
  { id: 'west-coast-swing', name: 'West Coast Swing', isSystem: true, terms: getTerms('westcoastswing') },
  { id: 'swing', name: 'Swing', isSystem: true, terms: getTerms('lindyhop') },
  { 
    id: 'belly-dance', 
    name: 'Belly Dance', 
    isSystem: true, 
    terms: [
      { canonicalTerm: 'Shimmy', variants: ['Hip shimmy', 'Shoulder shimmy', 'Knee shimmy'], category: 'vibration' },
      { canonicalTerm: 'Maya', variants: ['Vertical figure eight down'], category: 'figure_eight' },
      { canonicalTerm: 'Camel Walk', variants: ['Camel', 'Body undulation walk'], category: 'undulation' },
      { canonicalTerm: 'Chest Circle', variants: ['Chest roll', 'Upper torso circle'], category: 'isolation' },
      { canonicalTerm: 'Hip Drop', variants: ['Drop and kick'], category: 'accents' },
      { canonicalTerm: 'Figure Eight', variants: ['Horizontal figure 8', 'Vertical figure 8'], category: 'figure_eight' },
      { canonicalTerm: 'Snake Arms', variants: ['Arm wave'], category: 'arms' },
      { canonicalTerm: 'Hagallah', variants: ['Haggala step'], category: 'travelling' },
      { canonicalTerm: 'Choo Choo', variants: ['Choo-choo shimmy'], category: 'travelling' }
    ] 
  },
  { 
    id: 'ballet', 
    name: 'Ballet', 
    isSystem: true, 
    terms: [
      { canonicalTerm: 'Plié', variants: ['Demi-plié', 'Grand plié'], category: 'barre' },
      { canonicalTerm: 'Tendu', variants: ['Battement tendu'], category: 'barre' },
      { canonicalTerm: 'Dégagé', variants: ['Battement dégagé', 'Jeté'], category: 'barre' },
      { canonicalTerm: 'Rond de Jambe', variants: ['Rond de jambe à terre', 'En l\'air'], category: 'barre' },
      { canonicalTerm: 'Grand Battement', variants: ['Big kick'], category: 'barre' },
      { canonicalTerm: 'Pirouette', variants: ['En dehors', 'En dedans'], category: 'turns' },
      { canonicalTerm: 'Arabesque', variants: ['First arabesque', 'Second arabesque'], category: 'poses' },
      { canonicalTerm: 'Attitude', variants: ['Attitude derriere', 'Attitude devant'], category: 'poses' },
      { canonicalTerm: 'Chassé', variants: ['Chasse'], category: 'allegro' },
      { canonicalTerm: 'Jeté', variants: ['Grand jeté'], category: 'allegro' },
      { canonicalTerm: 'Pas de Bourrée', variants: ['Pas de bourree'], category: 'linking' },
      { canonicalTerm: 'Port de Bras', variants: ['Carriage of the arms'], category: 'arms' }
    ] 
  },
];
