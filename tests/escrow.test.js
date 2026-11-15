import test from 'node:test';
import assert from 'node:assert/strict';
import ganache from 'ganache';
import { BrowserProvider, ContractFactory } from 'ethers';
import solc from 'solc';
import { SAMPLE, localAnalyze, solidity, compile } from '../server/engine.js';
const mockToken = 'pragma solidity ^0.8.24; contract TestToken { uint8 public constant decimals=6; mapping(address=>uint256) public balanceOf; mapping(address=>mapping(address=>uint256)) public allowance; constructor(){balanceOf[msg.sender]=20000000000;} function approve(address s,uint256 n) external returns(bool){allowance[msg.sender][s]=n;return true;} function transfer(address to,uint256 n) external returns(bool){require(balanceOf[msg.sender]>=n);balanceOf[msg.sender]-=n;balanceOf[to]+=n;return true;} function transferFrom(address from,address to,uint256 n) external returns(bool){require(balanceOf[from]>=n && allowance[from][msg.sender]>=n);allowance[from][msg.sender]-=n;balanceOf[from]-=n;balanceOf[to]+=n;return true;} }';
async function setup(t) {
  const chain = ganache.provider({ logging: { quiet: true }, chain: { hardfork: 'shanghai' }, wallet: { totalAccounts: 3 } });
  t.after(async () => { await chain.disconnect(); });
  const provider = new BrowserProvider(chain); provider.pollingInterval = 20;
  const client = await provider.getSigner(0), contractor = await provider.getSigner(1), outsider = await provider.getSigner(2);
  const out = JSON.parse(solc.compile(JSON.stringify({ language:'Solidity',sources:{'Token.sol':{content:mockToken}},settings:{evmVersion:'shanghai',outputSelection:{'*':{'*':['abi','evm.bytecode.object']}}} })));
  const tokenArtifact = out.contracts['Token.sol'].TestToken;
  const token = await new ContractFactory(tokenArtifact.abi,tokenArtifact.evm.bytecode.object,client).deploy(); await token.waitForDeployment();
  const terms = {...localAnalyze(SAMPLE).terms,acceptance:'Client explicitly approves delivery after review.',jurisdiction:'California'};
  const artifact = compile(solidity(terms)).artifact;
  const escrow = await new ContractFactory(artifact.abi,artifact.evm.bytecode.object,client).deploy(await token.getAddress(),await contractor.getAddress()); await escrow.waitForDeployment();
  return {client,contractor,outsider,token,escrow};
}
test('deployed escrow enforces funding, client authorization and single release', async t => {
  const {client,contractor,outsider,token,escrow} = await setup(t);
  await assert.rejects(escrow.release.staticCall(0));
  await assert.rejects(escrow.connect(outsider).fund.staticCall());
  await assert.rejects(escrow.fund.staticCall());
  assert.equal(await escrow.funded(),false);
  await (await token.approve(await escrow.getAddress(),12000000000n)).wait();
  await (await escrow.fund()).wait();
  assert.equal(await token.balanceOf(await escrow.getAddress()),12000000000n);
  await assert.rejects(escrow.fund.staticCall());
  await assert.rejects(escrow.connect(contractor).release.staticCall(0));
  await assert.rejects(escrow.connect(outsider).release.staticCall(0));
  await assert.rejects(escrow.release.staticCall(99));
  await (await escrow.release(0)).wait();
  assert.equal(await token.balanceOf(await contractor.getAddress()),3000000000n);
  assert.equal(await escrow.remaining(),9000000000n);
  await assert.rejects(escrow.release.staticCall(0));
  assert.equal(await token.balanceOf(await client.getAddress()),8000000000n);
});
test('cancellation needs both parties, refunds only remaining funds, and freezes releases', async t => {
  const {client,contractor,outsider,token,escrow} = await setup(t);
  await (await token.approve(await escrow.getAddress(),12000000000n)).wait();
  await (await escrow.fund()).wait(); await (await escrow.release(0)).wait();
  await assert.rejects(escrow.connect(outsider).consentToCancellation.staticCall());
  await (await escrow.consentToCancellation()).wait(); assert.equal(await escrow.cancelled(),false);
  await (await escrow.connect(contractor).consentToCancellation()).wait();
  assert.equal(await escrow.cancelled(),true); assert.equal(await escrow.remaining(),0n);
  assert.equal(await token.balanceOf(await client.getAddress()),17000000000n);
  assert.equal(await token.balanceOf(await contractor.getAddress()),3000000000n);
  assert.equal(await token.balanceOf(await escrow.getAddress()),0n);
  await assert.rejects(escrow.release.staticCall(1)); await assert.rejects(escrow.fund.staticCall());
});
test('all milestones release the full agreement value without residual funds', async t => {
  const {contractor,token,escrow} = await setup(t);
  await (await token.approve(await escrow.getAddress(),12000000000n)).wait(); await (await escrow.fund()).wait();
  for (let i=0;i<3;i++) await (await escrow.release(i)).wait();
  assert.equal(await token.balanceOf(await contractor.getAddress()),12000000000n);
  assert.equal(await escrow.remaining(),0n); assert.equal(await token.balanceOf(await escrow.getAddress()),0n);
});
