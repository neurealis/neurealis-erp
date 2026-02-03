/**
 * handlers/index.ts - Re-export aller Handler
 *
 * Zentrale Export-Datei für alle Handler-Module
 */

// Start & Menü Handler
export {
  handleStart,
  showBaustellenMenu,
  showPhaseSelection,
  listProjekteByPhase,
  startAtbsDirectInput,
  listActiveProjekte,
  searchAndOpenProjekt,
  openProjekt,
  closeProjekt,
  getBauleiterDashboard,
  getProjektFavoriten,
  handleHelp,
  handleSync,
  handleStatus,
  handleAbbrechen,
  handleBriefingCommand
} from './start.ts';

// Aufmaß Handler
export {
  searchMatterportProject,
  handleCsvUpload,
  handleAufmassSelect,
  handleAufmassCreate,
  handleAufmassView,
  countCheckboxes
} from './aufmass.ts';

// Bedarfsanalyse Handler
export {
  handleBedarfsanalysePhoto,
  startOcrProcessing,
  handleOcrResult,
  callFinalizeAngebot,
  showAngebotSummary,
  listPositionen,
  showPositionDetail,
  handleSetAuftraggeber,
  handleAngebotConfirm,
  handleAngebotDiscard,
  handleAngebotExport,
  handlePositionOk,
  handlePositionRemove
} from './bedarfsanalyse.ts';

// Mangel Handler
export {
  startMangelMeldung,
  handleMangelText,
  handleMangelFoto
} from './mangel.ts';

// Nachtrag Handler
export {
  startNachtragErfassung,
  handleNachtragText,
  handleNachtragFoto,
  saveNachtrag
} from './nachtrag.ts';

// Nachweis Handler
export {
  showNachweisTypen,
  handleNachweisTyp,
  handleNachweisFoto
} from './nachweis.ts';

// Gewerke & Status
export {
  showGewerkStatus,
  showAusfuehrungsarten,
  showProjektStatus
} from './gewerke.ts';

// Foto-Verarbeitung
export {
  handleMultiFotoUpload,
  processPendingFotos
} from './foto.ts';

// Berichte & NU-Kommunikation
export {
  startBerichtErstellung,
  handleBerichtText,
  showNachrichtNuMenu,
  handleNuNachrichtTemplate,
  startEigeneNachrichtNU,
  handleEigeneNachrichtNU,
  sendNachrichtAnNU
} from './bericht.ts';

// Abnahmeprotokolle
export {
  showAbnahmeTypen,
  handleAbnahmeTyp,
  handleAbnahmeFoto
} from './abnahme.ts';
