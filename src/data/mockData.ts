export const ORANGE = '#F05A28';
export const ORANGE_DEEP = '#C9421A';

export const churnTrend = [
  { mes: 'Dic',  bajas: 1008, pctMotivo: 46.8, proyectado: false },
  { mes: 'Ene',  bajas: 996,  pctMotivo: 47.8, proyectado: false },
  { mes: 'Feb',  bajas: 1124, pctMotivo: 45.9, proyectado: false },
  { mes: 'Mar',  bajas: 1273, pctMotivo: 48.4, proyectado: false },
  { mes: 'Abr',  bajas: 1446, pctMotivo: 49.9, proyectado: false },
  { mes: 'May*', bajas: 1634, pctMotivo: null, proyectado: true  },
  { mes: 'Jun*', bajas: 1846, pctMotivo: null, proyectado: true  },
];

export const churnByMotivo = [
  { mes: 'Dic', total: 1008, definitivo: 192, temporal: 84, sinResp: 63, dejoUsar: 61, eligioOtro: 11, precio: 7, faltaFunc: 9, malServ: 8  },
  { mes: 'Ene', total: 996,  definitivo: 191, temporal: 76, sinResp: 92, dejoUsar: 42, eligioOtro: 17, precio: 6, faltaFunc: 11, malServ: 1 },
  { mes: 'Feb', total: 1124, definitivo: 222, temporal: 85, sinResp: 52, dejoUsar: 59, eligioOtro: 23, precio: 17, faltaFunc: 9, malServ: 6 },
  { mes: 'Mar', total: 1273, definitivo: 211, temporal: 119, sinResp: 104, dejoUsar: 61, eligioOtro: 35, precio: 14, faltaFunc: 10, malServ: 5 },
  { mes: 'Abr', total: 1446, definitivo: 218, temporal: 176, sinResp: 136, dejoUsar: 74, eligioOtro: 16, precio: 12, faltaFunc: 17, malServ: 7 },
];

export const motivosBaja = [
  { motivo: 'Sin motivo registrado', n: 3048, pct: 52.1, color: '#DC2626', brecha: true,  prioridad: 'CRÍTICA', accionable: 'BRECHA'  },
  { motivo: 'Cierre definitivo',     n: 1036, pct: 17.7, color: '#6B7280', brecha: false, prioridad: 'Media',   accionable: 'PARCIAL' },
  { motivo: 'Cierre temporal',       n: 540,  pct: 9.2,  color: '#2563EB', brecha: false, prioridad: 'ALTA',    accionable: 'SÍ'      },
  { motivo: 'Dejó de usar',          n: 297,  pct: 5.1,  color: '#D97706', brecha: false, prioridad: 'ALTA',    accionable: 'SÍ'      },
  { motivo: 'Precio elevado',        n: 170,  pct: 2.9,  color: '#F05A28', brecha: false, prioridad: 'ALTA',    accionable: 'SÍ'      },
  { motivo: 'Falta funcionalidades', n: 122,  pct: 2.1,  color: '#7C3AED', brecha: false, prioridad: 'Media',   accionable: 'SÍ'      },
  { motivo: 'Eligió otro sistema',   n: 102,  pct: 1.7,  color: '#DB2777', brecha: false, prioridad: 'Estrat.', accionable: 'SÍ'      },
  { motivo: 'Mal servicio',          n: 27,   pct: 0.5,  color: '#0D9488', brecha: false, prioridad: 'Media',   accionable: 'PARADOJA'},
];

export const npsPais = [
  { pais: 'Argentina', nps: 53.95, n: 2886, promotores: 66.8, detractores: 12.9, cuentas: 2064, alerta: false },
  { pais: 'Chile',     nps: 37.05, n: 2062, promotores: 60.5, detractores: 23.5, cuentas: 1696, alerta: true  },
  { pais: 'México',    nps: 54.69, n: 938,  promotores: 68.4, detractores: 13.8, cuentas: 1053, alerta: false },
  { pais: 'Colombia',  nps: 42.19, n: 768,  promotores: 61.9, detractores: 19.7, cuentas: 612,  alerta: false },
  { pais: 'Brasil',    nps: 54.41, n: 261,  promotores: 69.4, detractores: 14.9, cuentas: 365,  alerta: false },
];

export const npsPorGmv = [
  { grupo: 'Bajo (B2C+SC)',     n: 1236, nps: 47.57, detractores: 16.5 },
  { grupo: 'Medio (B2B1+B2B2)', n: 4492, nps: 48.82, detractores: 16.3 },
  { grupo: 'Alto (MM)',         n: 1071, nps: 44.54, detractores: 19.0 },
];

export const npsPorAntiguedad = [
  { rango: 'Nuevo (<60d)',     n: 241,  nps: 54.77, promotores: 69.3, detractores: 14.5 },
  { rango: 'Reciente (2m-1a)', n: 1738, nps: 47.76, promotores: 63.4, detractores: 15.6 },
  { rango: 'Entre 1 y 2 años', n: 1780, nps: 50.62, promotores: 66.0, detractores: 15.3 },
  { rango: 'Más de 2 años',    n: 3040, nps: 45.89, promotores: 64.3, detractores: 18.5 },
];

export const motivosDetraccion = [
  { motivo: 'Costo del sistema y módulos', n: 315, pct: 34.4 },
  { motivo: 'Otro motivo',                 n: 211, pct: 23.0 },
  { motivo: 'Atención al cliente',         n: 181, pct: 19.8 },
  { motivo: 'Dificultad gestión negocio',  n: 88,  pct: 9.6  },
  { motivo: 'Problemas delivery',          n: 48,  pct: 5.2  },
  { motivo: 'Dificultad salón/comensales', n: 43,  pct: 4.7  },
];

export const motivosPromocion = [
  { motivo: 'Gestión del negocio',        n: 1249, pct: 38.1 },
  { motivo: 'Operación salón/comensales', n: 735,  pct: 22.4 },
  { motivo: 'Costo vs funcionalidades',   n: 503,  pct: 15.4 },
  { motivo: 'Atención al cliente',        n: 282,  pct: 8.6  },
  { motivo: 'Otro motivo',                n: 260,  pct: 7.9  },
  { motivo: 'Gestión delivery',           n: 143,  pct: 4.4  },
];

export const desgloseCosto = [
  { submotivo: 'Precio del PLAN',             n: 170 },
  { submotivo: 'Tienda Online / Tu Delivery', n: 49  },
  { submotivo: 'Otro (costo)',                n: 34  },
  { submotivo: 'Módulo de Delivery',          n: 20  },
  { submotivo: 'Módulo de Facturación',       n: 11  },
  { submotivo: 'FudoPagos',                   n: 10  },
  { submotivo: 'Descuentos semestral',        n: 8   },
  { submotivo: 'Impresoras/equipos',          n: 4   },
];

export const csatMensual = [
  { mes: 'Ene', conversaciones: 944,  churnMes: 996,  rating4: 235, rating5: 709,  avg: 4.75 },
  { mes: 'Feb', conversaciones: 1094, churnMes: 1124, rating4: 240, rating5: 854,  avg: 4.78 },
  { mes: 'Mar', conversaciones: 1558, churnMes: 1273, rating4: 330, rating5: 1228, avg: 4.79 },
  { mes: 'Abr', conversaciones: 1775, churnMes: 1446, rating4: 381, rating5: 1394, avg: 4.79 },
  { mes: 'May', conversaciones: 710,  churnMes: null, rating4: 144, rating5: 566,  avg: 4.80 },
];

export const takeRateBuckets = [
  { bucket: 'Menor',      rango: '< 0.19%',       nps: 43.5, detracCosto: 5.1 },
  { bucket: 'Bajo-Medio', rango: '0.20% – 0.34%', nps: 46.7, detracCosto: 5.6 },
  { bucket: 'Medio-Alto', rango: '0.35% – 0.63%', nps: 45.0, detracCosto: 9.9 },
  { bucket: 'Mayor',      rango: '> 0.64%',       nps: 45.0, detracCosto: 8.6 },
];

export const cvrNeto = [
  { mes: 'Oct', cvr: 12.4 }, { mes: 'Nov', cvr: 16.2 },
  { mes: 'Dic', cvr: 18.2 }, { mes: 'Ene', cvr: 17.0 },
  { mes: 'Feb', cvr: 16.7 }, { mes: 'Mar', cvr: 18.7 },
  { mes: 'Abr', cvr: 19.9 },
];

export const tierDist = [
  { tier: 'Champion', count: 312, pct: 38.1, color: '#F05A28' },
  { tier: 'Healthy',  count: 287, pct: 35.1, color: '#1E5DBF' },
  { tier: 'At Risk',  count: 156, pct: 19.1, color: '#B5740F' },
  { tier: 'Critical', count:  63, pct:  7.7, color: '#B3261E' },
];

export const riskFlagDist = [
  { flag: 'MONO_CANAL',           count: 298, color: '#B5740F' },
  { flag: 'CUENTA_INACTIVA_+2M',  count: 187, color: '#B3261E' },
  { flag: 'ADOPCION_BAJA',        count: 156, color: '#D97706' },
  { flag: 'CAIDA_MODERADA_3M',    count: 112, color: '#F05A28' },
  { flag: 'ADOPCION_MINIMA',      count:  89, color: '#B3261E' },
  { flag: 'CAIDA_CRITICA_3M',     count:  47, color: '#B3261E' },
  { flag: 'NPS_DETRACTOR',        count:  38, color: '#7C3AED' },
  { flag: 'SIN_FLAGS',            count: 234, color: '#1E5DBF' },
];

export const featureGaps = [
  { gap: 'diversificar_canales', label: 'Diversificar canales',    cuentas: 287 },
  { gap: 'adopcion_features',    label: 'Adoptar más features',    cuentas: 198 },
  { gap: 'perfil_completo',      label: 'Completar perfil',        cuentas: 156 },
  { gap: 'volumen_ventas',       label: 'Aumentar volumen ventas', cuentas: 134 },
  { gap: 'uso_dispositivos',     label: 'Usar más dispositivos',   cuentas:  98 },
];

export type HealthAccount = {
  id: number; nombre: string; pais: string; plan: string; score: number;
  tier: 'Champion' | 'Healthy' | 'At Risk' | 'Critical';
  tendencia: string; trendDir: 'up' | 'down' | 'flat' | 'crit';
  flags: string[]; npsLtr: number | null; npsGrupo: string; csPrio: number;
};

export const healthAccounts: HealthAccount[] = [
  { id:917,  nombre:'Hasta la masa',          pais:'AR', plan:'Fu+Fi+Dv', score:97.4, tier:'Champion', tendencia:'Creciendo',       trendDir:'up',   flags:[],                                              npsLtr:null, npsGrupo:'—',         csPrio:10 },
  { id:6447, nombre:'Guelcom',                pais:'AR', plan:'St+Fi+Dv', score:100,  tier:'Champion', tendencia:'Creciendo +20%',  trendDir:'up',   flags:[],                                              npsLtr:null, npsGrupo:'—',         csPrio:9  },
  { id:5678, nombre:'Usina Cafetera',         pais:'AR', plan:'Pro+Dv',   score:97.4, tier:'Champion', tendencia:'Leve crecimiento',trendDir:'up',   flags:['NPS_DETRACTOR'],                               npsLtr:0,    npsGrupo:'Detractor', csPrio:10 },
  { id:12899,nombre:'Bagels & Bagels',        pais:'AR', plan:'St+Fi+Dv', score:91.3, tier:'Champion', tendencia:'Leve caída',      trendDir:'down', flags:[],                                              npsLtr:null, npsGrupo:'—',         csPrio:8  },
  { id:13386,nombre:'Roof Burger',            pais:'CL', plan:'Pro+Dv',   score:97.4, tier:'Champion', tendencia:'Leve crecimiento',trendDir:'up',   flags:[],                                              npsLtr:null, npsGrupo:'—',         csPrio:10 },
  { id:2029, nombre:'Barra Cervecera Lluvia', pais:'CL', plan:'Adv+Fi',   score:93.9, tier:'Champion', tendencia:'Estable',         trendDir:'flat', flags:['NPS_DETRACTOR'],                               npsLtr:3,    npsGrupo:'Detractor', csPrio:10 },
  { id:12335,nombre:'Layuntachile',           pais:'CL', plan:'St+Fi+Dv', score:94.6, tier:'Champion', tendencia:'Creciendo +20%',  trendDir:'up',   flags:[],                                              npsLtr:null, npsGrupo:'—',         csPrio:10 },
  { id:10929,nombre:'El tamaño si importa',   pais:'CL', plan:'Pro+Kds',  score:90.1, tier:'Champion', tendencia:'Leve crecimiento',trendDir:'up',   flags:[],                                              npsLtr:0,    npsGrupo:'Neutro',    csPrio:9  },
  { id:8304, nombre:'Restaurant Drive In',    pais:'CL', plan:'St',       score:82.9, tier:'Champion', tendencia:'Leve crecimiento',trendDir:'up',   flags:[],                                              npsLtr:null, npsGrupo:'—',         csPrio:8  },
  { id:1991, nombre:'Arte-Sano',              pais:'MX', plan:'Ba',       score:85.4, tier:'Champion', tendencia:'Estable',         trendDir:'flat', flags:[],                                              npsLtr:1,    npsGrupo:'Promotor',  csPrio:8  },
  { id:2807, nombre:'El Lago de los Patos',   pais:'MX', plan:'Ba+Dv',    score:88.5, tier:'Champion', tendencia:'Estable',         trendDir:'flat', flags:[],                                              npsLtr:null, npsGrupo:'—',         csPrio:7  },
  { id:4780, nombre:'Taqueria Diaz Grill',    pais:'MX', plan:'Adv+Tbl',  score:85.2, tier:'Champion', tendencia:'Estable',         trendDir:'flat', flags:[],                                              npsLtr:null, npsGrupo:'—',         csPrio:7  },
  { id:3790, nombre:'Dulce Maria',            pais:'AR', plan:'Fu+Fi',    score:88.1, tier:'Champion', tendencia:'Estable',         trendDir:'flat', flags:[],                                              npsLtr:null, npsGrupo:'—',         csPrio:7  },
  { id:1893, nombre:'Garay Parrilla',         pais:'AR', plan:'St+Fi+Dv', score:80.8, tier:'Champion', tendencia:'Leve crecimiento',trendDir:'up',   flags:[],                                              npsLtr:null, npsGrupo:'—',         csPrio:7  },
  { id:9727, nombre:'Ipanemaresto',           pais:'AR', plan:'St+Fi',    score:78.2, tier:'Champion', tendencia:'Estable',         trendDir:'flat', flags:[],                                              npsLtr:1,    npsGrupo:'Promotor',  csPrio:7  },
  { id:61,   nombre:'Delight Cafe',           pais:'AR', plan:'Adv+Fi',   score:67.8, tier:'Healthy',  tendencia:'Creciendo +20%',  trendDir:'up',   flags:['MONO_CANAL'],                                  npsLtr:null, npsGrupo:'—',         csPrio:46 },
  { id:52,   nombre:'Cafe de Siempre',        pais:'AR', plan:'Adv',      score:52.4, tier:'Healthy',  tendencia:'Estable',         trendDir:'flat', flags:['MONO_CANAL'],                                  npsLtr:null, npsGrupo:'—',         csPrio:38 },
  { id:185,  nombre:'Heladeria Chini',        pais:'AR', plan:'St',       score:71.0, tier:'Healthy',  tendencia:'Caída moderada',  trendDir:'down', flags:['CAIDA_MODERADA_3M','MONO_CANAL'],              npsLtr:null, npsGrupo:'—',         csPrio:46 },
  { id:872,  nombre:'Restaurante AguaMar',    pais:'CL', plan:'Fu',       score:77.2, tier:'Champion', tendencia:'Estable',         trendDir:'flat', flags:[],                                              npsLtr:1,    npsGrupo:'Promotor',  csPrio:25 },
  { id:3687, nombre:'Saborne',                pais:'MX', plan:'Adv+Tbl',  score:61.2, tier:'Healthy',  tendencia:'Estable',         trendDir:'flat', flags:['MONO_CANAL'],                                  npsLtr:1,    npsGrupo:'Promotor',  csPrio:46 },
  { id:2640, nombre:'Vidas Comunes',          pais:'AR', plan:'Ba',       score:60.4, tier:'Healthy',  tendencia:'Creciendo +20%',  trendDir:'up',   flags:['ADOPCION_BAJA'],                               npsLtr:null, npsGrupo:'—',         csPrio:30 },
  { id:3612, nombre:'Prueba Mividal',         pais:'UY', plan:'Ba',       score:50.2, tier:'Healthy',  tendencia:'Caída moderada',  trendDir:'down', flags:['CAIDA_MODERADA_3M','MONO_CANAL','ADOPCION_MINIMA'], npsLtr:null, npsGrupo:'—',    csPrio:44 },
  { id:5247, nombre:'Bufetera',               pais:'MX', plan:'St+Fi+Dv', score:68.7, tier:'Healthy',  tendencia:'Estable',         trendDir:'flat', flags:['CUENTA_INACTIVA_+2M','NPS_DETRACTOR'],         npsLtr:-1,   npsGrupo:'Detractor', csPrio:46 },
  { id:3257, nombre:'Rustico Carnes & Pastas',pais:'CL', plan:'Adv+Dv',   score:64.4, tier:'Healthy',  tendencia:'Estable',         trendDir:'flat', flags:['CUENTA_INACTIVA_+2M','NPS_DETRACTOR'],         npsLtr:-1,   npsGrupo:'Detractor', csPrio:46 },
  { id:5585, nombre:'Restaurant Barloventos', pais:'CL', plan:'Adv',      score:71.5, tier:'Healthy',  tendencia:'Caída crítica',   trendDir:'crit', flags:['CAIDA_CRITICA_3M'],                            npsLtr:null, npsGrupo:'—',         csPrio:46 },
  { id:4326, nombre:'Tinta Roja',             pais:'AR', plan:'Ba',       score:47.4, tier:'At Risk',  tendencia:'Caída crítica',   trendDir:'crit', flags:['CAIDA_CRITICA_3M'],                            npsLtr:null, npsGrupo:'—',         csPrio:38 },
  { id:5405, nombre:'Esquina Taki',           pais:'AR', plan:'Pro+Fi',   score:62.6, tier:'Healthy',  tendencia:'Caída crítica',   trendDir:'crit', flags:['CAIDA_CRITICA_3M'],                            npsLtr:null, npsGrupo:'—',         csPrio:46 },
  { id:11597,nombre:'La Ventana de Elisa',    pais:'CL', plan:'Ba',       score:61.6, tier:'Healthy',  tendencia:'Caída crítica',   trendDir:'crit', flags:['CAIDA_CRITICA_3M'],                            npsLtr:null, npsGrupo:'—',         csPrio:46 },
  { id:12576,nombre:'Blue Mountain',          pais:'CL', plan:'Fu+Dv',    score:58.3, tier:'Healthy',  tendencia:'Caída crítica',   trendDir:'crit', flags:['CAIDA_CRITICA_3M'],                            npsLtr:null, npsGrupo:'—',         csPrio:34 },
  { id:1764, nombre:'Peru Fusion',            pais:'CL', plan:'Adv+Tbl',  score:49.2, tier:'At Risk',  tendencia:'Estable',         trendDir:'flat', flags:['MONO_CANAL'],                                  npsLtr:null, npsGrupo:'—',         csPrio:37 },
  { id:8535, nombre:'Refugio de Navegantes',  pais:'CL', plan:'Ini+Tbl',  score:45.5, tier:'At Risk',  tendencia:'Caída moderada',  trendDir:'down', flags:['CAIDA_MODERADA_3M','MONO_CANAL','ADOPCION_BAJA'], npsLtr:null, npsGrupo:'—',     csPrio:42 },
  { id:9550, nombre:'La Creciente',           pais:'AR', plan:'Ba',       score:46.3, tier:'At Risk',  tendencia:'Caída moderada',  trendDir:'down', flags:['CAIDA_MODERADA_3M'],                           npsLtr:null, npsGrupo:'—',         csPrio:39 },
  { id:1994, nombre:'La Melesca',             pais:'AR', plan:'Ba',       score:44.3, tier:'At Risk',  tendencia:'Estable',         trendDir:'flat', flags:['CUENTA_INACTIVA_+2M'],                         npsLtr:1,    npsGrupo:'Promotor',  csPrio:40 },
  { id:8830, nombre:'Elvestidor Multiespacio',pais:'AR', plan:'Ba',       score:38.9, tier:'At Risk',  tendencia:'Creciendo',       trendDir:'up',   flags:['MONO_CANAL','ADOPCION_MINIMA'],                npsLtr:null, npsGrupo:'—',         csPrio:44 },
  { id:9715, nombre:'La Boheme Sala',         pais:'AR', plan:'Adv',      score:41.1, tier:'At Risk',  tendencia:'Estable',         trendDir:'flat', flags:['MONO_CANAL','CUENTA_INACTIVA_+2M'],            npsLtr:null, npsGrupo:'—',         csPrio:42 },
  { id:10475,nombre:'Charlá Cafe',            pais:'AR', plan:'Ba+Fi',    score:43.3, tier:'At Risk',  tendencia:'Caída moderada',  trendDir:'down', flags:['CAIDA_MODERADA_3M','MONO_CANAL'],              npsLtr:null, npsGrupo:'—',         csPrio:44 },
  { id:5116, nombre:'Daniels Coffee & Soda',  pais:'MX', plan:'Ba',       score:34.0, tier:'At Risk',  tendencia:'Estable',         trendDir:'flat', flags:['MONO_CANAL','CUENTA_INACTIVA_+2M'],            npsLtr:1,    npsGrupo:'Promotor',  csPrio:48 },
  { id:7179, nombre:'Danielstulte',           pais:'MX', plan:'Ba',       score:34.7, tier:'At Risk',  tendencia:'Estable',         trendDir:'flat', flags:['MONO_CANAL','CUENTA_INACTIVA_+2M'],            npsLtr:null, npsGrupo:'—',         csPrio:48 },
  { id:8713, nombre:'La Merluza',             pais:'MX', plan:'St',       score:35.5, tier:'At Risk',  tendencia:'Estable',         trendDir:'flat', flags:['MONO_CANAL','CUENTA_INACTIVA_+2M'],            npsLtr:null, npsGrupo:'—',         csPrio:47 },
  { id:5535, nombre:'El Grill de Charly',     pais:'MX', plan:'Ba',       score:35.4, tier:'At Risk',  tendencia:'Estable',         trendDir:'flat', flags:['ADOPCION_BAJA','CUENTA_INACTIVA_+2M'],         npsLtr:0,    npsGrupo:'Detractor', csPrio:47 },
  { id:12557,nombre:'Lupita',                 pais:'CL', plan:'St',       score:33.6, tier:'At Risk',  tendencia:'Estable',         trendDir:'flat', flags:['MONO_CANAL','CUENTA_INACTIVA_+2M'],            npsLtr:null, npsGrupo:'—',         csPrio:48 },
  { id:1683, nombre:'Hosteria La Camila',     pais:'CL', plan:'St',       score:36.1, tier:'At Risk',  tendencia:'Estable',         trendDir:'flat', flags:['MONO_CANAL','ADOPCION_BAJA','CUENTA_INACTIVA_+2M'], npsLtr:null, npsGrupo:'—',     csPrio:49 },
  { id:9918, nombre:'Chelsea',                pais:'CL', plan:'Ba',       score:41.2, tier:'At Risk',  tendencia:'Estable',         trendDir:'flat', flags:['MONO_CANAL','ADOPCION_MINIMA'],               npsLtr:null, npsGrupo:'—',         csPrio:44 },
  { id:13603,nombre:'Cioccolato',             pais:'CL', plan:'Ba',       score:45.4, tier:'At Risk',  tendencia:'Estable',         trendDir:'flat', flags:['CUENTA_INACTIVA_+2M'],                         npsLtr:null, npsGrupo:'—',         csPrio:42 },
  { id:8185, nombre:'Julianas',               pais:'MX', plan:'Ini+Tbl',  score:10.2, tier:'Critical', tendencia:'Estable',         trendDir:'flat', flags:['MONO_CANAL','ADOPCION_MINIMA','CUENTA_INACTIVA_+2M'], npsLtr:null, npsGrupo:'—', csPrio:58 },
  { id:9119, nombre:'Les Amis',               pais:'AR', plan:'St',       score:12.5, tier:'Critical', tendencia:'Estable',         trendDir:'flat', flags:['MONO_CANAL','ADOPCION_BAJA','CUENTA_INACTIVA_+2M'],  npsLtr:null, npsGrupo:'—', csPrio:56 },
  { id:9797, nombre:'Umami',                  pais:'AR', plan:'Ba+Fi',    score:9.6,  tier:'Critical', tendencia:'Estable',         trendDir:'flat', flags:['ADOPCION_MINIMA','CUENTA_INACTIVA_+2M'],       npsLtr:null, npsGrupo:'—',         csPrio:56 },
  { id:13793,nombre:'Piña Express',           pais:'CL', plan:'Ba',       score:11.3, tier:'Critical', tendencia:'Estable',         trendDir:'flat', flags:['MONO_CANAL','ADOPCION_MINIMA','CUENTA_INACTIVA_+2M'], npsLtr:null, npsGrupo:'—', csPrio:56 },
  { id:13577,nombre:'Oldjager',               pais:'AR', plan:'Adv+Tbl',  score:7.9,  tier:'Critical', tendencia:'Estable',         trendDir:'flat', flags:['ACTIVIDAD_MUY_BAJA','SIN_CANALES'],            npsLtr:null, npsGrupo:'—',         csPrio:52 },
  { id:9401, nombre:'Afrigonia',              pais:'CL', plan:'Ba',       score:6.4,  tier:'Critical', tendencia:'Estable',         trendDir:'flat', flags:['MONO_CANAL','ADOPCION_BAJA','CUENTA_INACTIVA_+2M'], npsLtr:null, npsGrupo:'—',   csPrio:52 },
  { id:8740, nombre:'Pub Bufon',              pais:'CL', plan:'Ba',       score:14.0, tier:'Critical', tendencia:'Estable',         trendDir:'flat', flags:['MONO_CANAL','ADOPCION_BAJA','CUENTA_INACTIVA_+2M'], npsLtr:null, npsGrupo:'—',   csPrio:53 },
];

export const verbatims = [
  { ltr: 4,  tipo: 'Detractor', pais: 'Chile',     plan: 'Avanzado', submotivo: 'Precio del Plan',
    texto: 'Estoy con ustedes desde los casi inicios... antes eran tan buenos en relacion precio calidad... de a poco y de manera muy unilateral suben sus precios agregando modulos... esas alzas que son de un día para el otro avisan y si te gusta bien si no te vas. eso es muy decepcionante.' },
  { ltr: 4,  tipo: 'Detractor', pais: 'Colombia',  plan: 'Avanzado', submotivo: 'Tienda Online / Tu Delivery',
    texto: 'Con el módulo nuevo de Tu Delivery el costo se incremento a más del doble de lo que veníamos pagando, ya que no requerimos NINGUNA de las nuevas funcionalidades... se nos hace impagable continuar.' },
  { ltr: 3,  tipo: 'Detractor', pais: 'México',    plan: 'Avanzado', submotivo: 'Tienda Online / Tu Delivery',
    texto: 'Me parece absurdo que cobren comisiones cuando ya se está pagando por el servicio de la plataforma... este mes terminé pagando el doble de mi mensualidad, me parece un completo abuso.' },
  { ltr: 4,  tipo: 'Detractor', pais: 'Argentina', plan: 'Pro',      submotivo: 'Precio del Plan',
    texto: 'El sistema es muy bueno, pero han actualizado los precios por encima de la inflación y las mejoras son dirigidas a grandes negocios/cadenas. A los más pequeños no nos influye y nos encarece.' },
  { ltr: 10, tipo: 'Promotor',  pais: 'Argentina', plan: 'Pro',      submotivo: null,
    texto: 'De Fudo me gusta todo. Me encanta que siempre están mejorando y agregando funciones. Lo que estaría faltando es poder hacer toda la gestión dentro de Fudo, para abandonar definitivamente las planillas de Excel.' },
  { ltr: 10, tipo: 'Promotor',  pais: 'Argentina', plan: 'Pro',      submotivo: null,
    texto: 'Lo único que no me gustó es que cambiaron el método de respuesta cuando uno hace consultas. Antes era directo, te atendía una persona, no se perdía tiempo. Ahora tardas muchísimo hasta hablar con una persona. Eso lo veo un retroceso.' },
];

export const kpiTargets = [
  { kpi: 'Tasa de Churn Mensual',      baseline: '~1,273/mes', target3m: '<1,100', target6m: '<900', current: '1,446', status: 'rojo' },
  { kpi: '% Bajas con Motivo',         baseline: '47.9%',      target3m: '>70%',   target6m: '>90%', current: '49.9%', status: 'rojo' },
  { kpi: 'NPS Global',                 baseline: '47.71',      target3m: '≥48',    target6m: '>50',  current: '47.71', status: 'estable' },
  { kpi: 'NPS Chile',                  baseline: '37.05',      target3m: '>42',    target6m: '>48',  current: '37.05', status: 'critico' },
  { kpi: '% Detractores por Costo',    baseline: '26.5%',      target3m: '<22%',   target6m: '<18%', current: '26.5%', status: 'vigilar' },
  { kpi: 'CSAT Promedio',              baseline: '4.78/5.0',   target3m: '>4.7',   target6m: '>4.7', current: '4.78',  status: 'verde' },
  { kpi: 'CVR Neto de Bajas',          baseline: '19.9%',      target3m: '>22%',   target6m: '>25%', current: '19.9%', status: 'verde' },
  { kpi: 'Cuentas sin login +14 días', baseline: 'sin dato',   target3m: '<5% ARR',target6m: '<3%',  current: '—',     status: 'sindato' },
];

export const iniciativas = [
  { id:1, titulo:'Plan de Pausa de suscripción',         prioridad:'ALTA',         owner:'Product + CS',       timeline:'2-4 semanas', impacto:'Retención 137-200 cuentas/mes',    estado:'planificado',  descripcion:'Implementar opción de pausa 30-60 días para cuentas con cierre temporal, capturando 21.2% del churn.' },
  { id:2, titulo:'Cruce Contact Rate × Churn',           prioridad:'ALTA',         owner:'CS Ops + Data',      timeline:'1-2 semanas', impacto:'Calibra ventana de intervención',  estado:'en_progreso',  descripcion:'Cruzar datos de Intercom (Deal Acct ID) con churned accounts para identificar señales previas a la baja.' },
  { id:3, titulo:'Login Frequency como KPI',             prioridad:'ALTA',         owner:'Product + CS',       timeline:'3-6 semanas', impacto:'Detección temprana de churn silencioso', estado:'planificado', descripcion:'Alertas automáticas: sin login 14 días = amarillo, sin login 30 días = rojo + contacto proactivo.' },
  { id:4, titulo:'Motivo obligatorio en HubSpot',        prioridad:'MEDIA',        owner:'CS Ops + RevOps',    timeline:'1 semana',    impacto:'Elimina brecha del 52.1%',         estado:'planificado',  descripcion:'Campo requerido al mover cuenta a etapa Bajas + revisión retroactiva de 3,048 registros sin motivo.' },
  { id:5, titulo:'Auditoría Onboarding Chile',           prioridad:'ESTRATÉGICO', owner:'CS LATAM + CX Chile', timeline:'4-8 semanas', impacto:'Reduce NPS gap -16.9 pts vs ARG',  estado:'planificado',  descripcion:'Mapear customer journey primeras 8 semanas en CL vs ARG. Chile lidera "Dejó de usar" con 7.4%.' },
  { id:6, titulo:'Comunicación transparente de precios', prioridad:'ALTA',         owner:'Marketing + Product', timeline:'2-3 semanas', impacto:'Reduce detractores por costo (26.5%)', estado:'en_progreso', descripcion:'30 días de anticipación + email transparente + breakdown de mejoras.' },
  { id:7, titulo:'Encuesta a 102 cuentas perdidas',      prioridad:'ESTRATÉGICO', owner:'CS Insights',         timeline:'3-4 semanas', impacto:'Mapea competencia y drivers de switching', estado:'planificado', descripcion:'Chile concentra 35% (36/102). Submotivo: complejidad en el uso, NO que el competidor sea mejor.' },
];
