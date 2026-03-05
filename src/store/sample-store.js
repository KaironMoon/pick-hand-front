import { atom } from "jotai";
import sampleServices from "../services/sample-services";

const sampleInfoAtom = atom({});
const sampleListAtom = atom([]);

const getSampleAtom = atom(null, async (get, set, { id }) => {
  const sample = await sampleServices.getSample(id);
  set(sampleInfoAtom, sample);
});

const getSampleListAtom = atom(null, async (get, set, { page, size }) => {
  const samples = await sampleServices.getSamples(page, size);
  set(sampleListAtom, samples);
});

const addSampleAtom = atom(null, async (get, set, { data }) => {
  const sample = await sampleServices.postSample(data);
  set(sampleInfoAtom, sample);
});

const updateSampleAtom = atom(null, async (get, set, { id, data }) => {
  const sample = await sampleServices.putSample(id, data);
  set(sampleInfoAtom, sample);
});

const deleteSampleAtom = atom(null, async (get, set, { id }) => {
  const sample = await sampleServices.deleteSample(id);
  set(getSampleAtom, {});
});

export {
  sampleInfoAtom,
  sampleListAtom,
  getSampleAtom,
  getSampleListAtom,
  addSampleAtom,
  updateSampleAtom,
  deleteSampleAtom,
};
