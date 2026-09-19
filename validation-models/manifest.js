'use strict';

/*
 * Permanent Systemika validation models.
 *
 * Each entry has a numerical model specification plus a simple expectation.
 * Matching .ssd files in this directory are classroom-openable fixtures built
 * from the same definitions. These are intentionally small and transparent.
 */
module.exports = [
  {
    file: '01-constant-inflow.ssd', title: 'Constant Inflow',
    spec: { timeStart: 0, timeLength: 5, dt: 1, method: 'Euler',
      stocks: [{id:'s',name:'Stock',initial:'0'}],
      flows: [{id:'f',name:'Inflow',equation:'10',targetId:'s'}] },
    expect: { id:'s', final:50, tolerance:1e-12 }
  },
  {
    file: '02-constant-outflow.ssd', title: 'Constant Outflow',
    spec: { timeStart: 0, timeLength: 5, dt: 1, method: 'Euler',
      stocks: [{id:'s',name:'Stock',initial:'100'}],
      flows: [{id:'f',name:'Outflow',equation:'10',sourceId:'s'}] },
    expect: { id:'s', final:50, tolerance:1e-12 }
  },
  {
    file: '03-exponential-growth-euler.ssd', title: 'Exponential Growth — Euler',
    spec: { timeStart: 0, timeLength: 10, dt: 0.1, method: 'Euler',
      stocks: [{id:'p',name:'Population',initial:'100'}],
      variables: [{id:'r',name:'Growth Rate',equation:'0.1'}],
      flows: [{id:'g',name:'Growth',equation:'[Growth Rate] * [Population]',targetId:'p'}] },
    expect: { id:'p', final:270.4813829421528, tolerance:1e-9 }
  },
  {
    file: '04-exponential-growth-rk4.ssd', title: 'Exponential Growth — RK4',
    spec: { timeStart: 0, timeLength: 10, dt: 0.25, method: 'RK4',
      stocks: [{id:'p',name:'Population',initial:'100'}],
      flows: [{id:'g',name:'Growth',equation:'0.1 * [Population]',targetId:'p'}] },
    expect: { id:'p', final:100*Math.E, tolerance:0.0001 }
  },
  {
    file: '05-exponential-decay.ssd', title: 'Exponential Decay',
    spec: { timeStart: 0, timeLength: 10, dt: 0.25, method: 'RK4',
      stocks: [{id:'s',name:'Amount',initial:'100'}],
      flows: [{id:'f',name:'Loss',equation:'0.2 * [Amount]',sourceId:'s'}] },
    expect: { id:'s', final:100*Math.exp(-2), tolerance:0.0001 }
  },
  {
    file: '06-stock-transfer.ssd', title: 'Two-Stock Transfer',
    spec: { timeStart: 0, timeLength: 8, dt: 0.2, method: 'RK4',
      stocks: [{id:'a',name:'A',initial:'100'},{id:'b',name:'B',initial:'0'}],
      flows: [{id:'m',name:'Transfer',equation:'0.25 * [A]',sourceId:'a',targetId:'b'}] },
    expect: { conservation:['a','b'], total:100, tolerance:1e-9 }
  },
  {
    file: '07-auxiliary-chain.ssd', title: 'Auxiliary Chain',
    spec: { timeStart: 0, timeLength: 3, dt: 1, method: 'Euler',
      variables: [{id:'a',name:'A',equation:'2'},{id:'b',name:'B',equation:'[A] * 3'},{id:'c',name:'C',equation:'[B] + 4'}] },
    expect: { id:'c', final:10, tolerance:1e-12 }
  },
  {
    file: '08-constant-parameter.ssd', title: 'Constant Parameter',
    spec: { timeStart: 0, timeLength: 4, dt: 1, method: 'Euler',
      stocks: [{id:'s',name:'Stock',initial:'0'}],
      variables: [{id:'k',name:'Rate',equation:'3'}],
      flows: [{id:'f',name:'Inflow',equation:'[Rate]',targetId:'s'}] },
    expect: { id:'s', final:12, tolerance:1e-12 }
  },
  {
    file: '09-linear-lookup.ssd', title: 'Linear Lookup',
    spec: { timeStart: 0, timeLength: 3, dt: 0.5, method: 'Euler',
      converters: [{id:'l',name:'Lookup',data:'0,0;1,10;2,20;3,30',sourceId:'Time',interpolation:'Linear'}] },
    expect: { id:'l', final:30, tolerance:1e-12 }
  },
  {
    file: '10-ifthenelse.ssd', title: 'IfThenElse',
    spec: { timeStart: 0, timeLength: 4, dt: 0.25, method: 'RK4',
      stocks: [{id:'s',name:'Stock',initial:'0'}],
      flows: [{id:'f',name:'Inflow',equation:'IfThenElse(T() < 2, 1, 3)',targetId:'s'}] },
    expect: { id:'s', final:8, tolerance:0.1 }
  },
  {
    file: '11-multiple-flows.ssd', title: 'Multiple Inflows and Outflows',
    spec: { timeStart: 0, timeLength: 5, dt: 1, method: 'Euler',
      stocks: [{id:'s',name:'Stock',initial:'10'}],
      flows: [
        {id:'i1',name:'Inflow 1',equation:'4',targetId:'s'},
        {id:'i2',name:'Inflow 2',equation:'2',targetId:'s'},
        {id:'o',name:'Outflow',equation:'1',sourceId:'s'}
      ] },
    expect: { id:'s', final:35, tolerance:1e-12 }
  },
  {
    file: '12-goal-seeking.ssd', title: 'Goal Seeking',
    spec: { timeStart: 0, timeLength: 10, dt: 0.25, method: 'RK4',
      stocks: [{id:'s',name:'State',initial:'0'}],
      variables: [{id:'g',name:'Goal',equation:'100'},{id:'t',name:'Adjustment Time',equation:'2'}],
      flows: [{id:'f',name:'Adjustment',equation:'([Goal] - [State]) / [Adjustment Time]',targetId:'s'}] },
    expect: { id:'s', final:100*(1-Math.exp(-5)), tolerance:0.001 }
  },
  {
    file: '13-discrete-lookup.ssd', title: 'Discrete Lookup',
    spec: { timeStart: 0, timeLength: 2.5, dt: 0.5, method: 'Euler',
      converters: [{id:'l',name:'Lookup',data:'0,5;1,10;2,20;3,40',sourceId:'Time',interpolation:'Discrete'}] },
    expect: { id:'l', final:20, tolerance:1e-12 }
  },
  {
    file: '14-nonnegative-stock.ssd', title: 'Nonnegative Stock',
    spec: { timeStart: 0, timeLength: 3, dt: 1, method: 'Euler',
      stocks: [{id:'s',name:'Inventory',initial:'1',nonNegative:true}],
      flows: [{id:'o',name:'Demand',equation:'5',sourceId:'s'}] },
    expect: { id:'s', final:0, tolerance:1e-12 }
  },
  {
    file: '15-link-polarity.ssd', title: 'Link Polarity Annotation',
    spec: { timeStart: 0, timeLength: 2, dt: 1, method: 'Euler',
      variables: [{id:'a',name:'Cause',equation:'2'},{id:'b',name:'Effect',equation:'[Cause] * 4'}] },
    links: [{id:'l',sourceId:'a',targetId:'b',polarity:'+'}],
    expect: { id:'b', final:8, tolerance:1e-12 }
  },
  {
    file: '16-programming-functions.ssd', title: 'Smooth Delay and Lag',
    spec: { timeStart: 0, timeLength: 4, dt: 0.05, method: 'RK4',
      variables: [
        {id:'input',name:'Input',equation:'T()'},
        {id:'lag',name:'Lagged',equation:'Lag([Input], 2, -1)'},
        {id:'smooth',name:'Smoothed',equation:'Smooth(10, 4, 2, 0)'},
        {id:'delay',name:'Delayed',equation:'Delay(10, 4, 2, 0)'}
      ] },
    expect: { id:'lag', final:2, tolerance:1e-10 }
  },
  {
    file: '17-statistical-functions.ssd', title: 'Statistical Functions',
    spec: { timeStart: 0, timeLength: 4, dt: 1, method: 'RK4',
      variables: [
        {id:'u',name:'Uniform',equation:'RandomUniform(0, 1, 101)'},
        {id:'n',name:'Normal',equation:'RandomNormal(0, 1, 102)'},
        {id:'t',name:'Triangular',equation:'RandomTriangular(0, 1, 0.5, 103)'},
        {id:'g',name:'Gamma',equation:'RandomGamma(2, 1, 104)'},
        {id:'b',name:'Beta',equation:'RandomBeta(2, 5, 105)'}
      ] },
    expect: { id:'u', range:[0,1], stochastic:true }
  }  ,
  {
    file: '18-negative-flow.ssd', title: 'Signed Negative Flow',
    spec: { timeStart: 0, timeLength: 3, dt: 1, method: 'Euler',
      stocks: [{id:'a',name:'A',initial:'0'},{id:'b',name:'B',initial:'10'}],
      flows: [{id:'f',name:'Transfer',equation:'-2',sourceId:'a',targetId:'b',nonNegative:true}] },
    expect: { id:'a', final:6, tolerance:1e-12, conservation:['a','b'], total:10 }
  },
  {
    file: '19-bare-multiline-equation.ssd', title: 'Bare Multiline Equation',
    spec: { timeStart: 0, timeLength: 60, dt: 20, method: 'Euler',
      variables: [{id:'stage',name:'Stage',equation:'IfThenElse(T<20, 1,\nIfThenElse(T<40, 2,\nIfThenElse(T<60, 3, 4)))'}] },
    expect: { id:'stage', final:4, tolerance:1e-12 }
  }

];
