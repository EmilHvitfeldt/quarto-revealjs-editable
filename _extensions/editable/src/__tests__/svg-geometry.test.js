import { describe, it, expect } from 'vitest';
import { combinedSVGMatrix, identityMatrix, inverseMatrix, multiplyMatrices, resizeSVGState, svgStateMatrix } from '../svg-geometry.js';

const point = (m,x,y) => [m[0]*x+m[2]*y+m[4],m[1]*x+m[3]*y+m[5]];
const closePoint = (actual, expected) => expected.forEach((value,i)=>expect(actual[i]).toBeCloseTo(value,9));
const initial = () => ({x:0,y:0,matrix:identityMatrix(),order:0});

describe('diagram part resizing', () => {
  it('expands a bottom-right corner without moving the opposite corner', () => {
    const state=resizeSVGState(initial(),{x:20,y:30,width:100,height:50},'se',50,25);
    expect(point(svgStateMatrix(state),20,30)).toEqual([20,30]);
    expect(point(svgStateMatrix(state),120,80)).toEqual([170,105]);
  });
  it('resizes the left edge while preserving its right edge and the vertical coordinates', () => {
    const state=resizeSVGState(initial(),{x:20,y:30,width:100,height:50},'w',-20,40);
    closePoint(point(svgStateMatrix(state),20,30),[0,30]);
    expect(point(svgStateMatrix(state),120,80)).toEqual([120,80]);
  });
  it('resizes after a move, then allows another move without losing the scale', () => {
    const moved={...initial(),x:10,y:-5};
    const state=resizeSVGState(moved,{x:30,y:25,width:100,height:50},'se',50,25);
    expect(point(svgStateMatrix(state),20,30)).toEqual([30,25]);
    expect(point(svgStateMatrix({...state,x:7,y:3}),120,80)).toEqual([187,103]);
    expect(moved.matrix).toEqual(identityMatrix());
  });
  it('clamps a crossing handle and can maintain proportions with Shift', () => {
    const box={x:20,y:30,width:100,height:50};
    const clamped=resizeSVGState(initial(),box,'nw',200,100,{minSize:4});
    closePoint(point(svgStateMatrix(clamped),20,30),[116,76]);
    closePoint(point(svgStateMatrix(clamped),120,80),[120,80]);
    const proportional=resizeSVGState(initial(),box,'se',50,0,{keepAspect:true});
    expect(proportional.matrix[0]).toBe(1.5);
    expect(proportional.matrix[3]).toBe(1.5);
  });
  it('keeps horizontal arrows horizontal while changing their length', () => {
    const state=resizeSVGState(initial(),{x:20,y:30,width:100,height:0},'se',50,100);
    expect(point(svgStateMatrix(state),20,30)).toEqual([20,30]);
    expect(point(svgStateMatrix(state),120,30)).toEqual([170,30]);
  });
  it('applies identical scaling to a box, its label and a separately authored arrowhead', () => {
    const box={},label={},arrow={},head={},unrelated={};
    const state=resizeSVGState(initial(),{x:20,y:30,width:100,height:50},'se',50,25);
    const parts=[{members:[box,label],state},{members:[arrow,head],state}];
    expect(combinedSVGMatrix(parts,box)).toEqual(combinedSVGMatrix(parts,label));
    expect(combinedSVGMatrix(parts,arrow)).toEqual(combinedSVGMatrix(parts,head));
    expect(combinedSVGMatrix(parts,unrelated)).toEqual(identityMatrix());
  });
  it('reconciles the newest clone edit for serialization without flattening other edits', () => {
    const member={},a={members:[member],state:{...initial(),x:5}},b={members:[member],state:initial()};
    const resized=resizeSVGState(initial(),{x:0,y:0,width:100,height:100},'se',100,100);
    const matrix=combinedSVGMatrix([a,b],member,part=>part===b?resized:part.state);
    expect(point(matrix,10,10)).toEqual([25,20]);
    expect(a.state.x).toBe(5);
    expect(b.state.matrix).toEqual(identityMatrix());
  });
  it('conjugates through a rotated/scaled parent while preserving its authored transform', () => {
    const parent=[0,2,-2,0,100,200],inverse=[0,-.5,.5,0,-100,50];
    const rootResize=resizeSVGState(initial(),{x:20,y:30,width:100,height:50},'se',50,25).matrix;
    const local=multiplyMatrices(inverse,multiplyMatrices(rootResize,parent));
    const actual=point(parent,...point(local,10,20));
    const expected=point(rootResize,...point(parent,10,20));
    expect(actual).toEqual(expected);
  });
  it('resizes a nested part by the pointer distance after its containing box was scaled', () => {
    const prefixMatrix=[2,0,0,2,10,20];
    const state=resizeSVGState(initial(),{x:50,y:80,width:200,height:100},'se',40,20,{prefixMatrix});
    const actual=multiplyMatrices(prefixMatrix,svgStateMatrix(state));
    closePoint(point(actual,20,30),[50,80]);
    closePoint(point(actual,120,80),[290,200]);
  });
  it('rejects singular transforms rather than emitting invalid SVG coordinates', () => {
    expect(()=>inverseMatrix([0,0,0,0,0,0])).toThrow('singular');
  });
});
