
'use server';

import { db } from '@/lib/firebase';
import { collection, addDoc, getDocs, query, where, doc, updateDoc, serverTimestamp, Timestamp } from 'firebase/firestore';

export interface Sample {
  id: string;
  name: string;
  url: string;
  fileKey: string;
  groupKey: string;
  padKey: string;
  createdAt?: string; // Cambiado a string para serialización
}

// Función para convertir Timestamps a strings
const processSampleDoc = (doc: any): Sample => {
    const data = doc.data();
    const createdAt = data.createdAt;
    
    let createdAtString: string | undefined = undefined;
    if (createdAt instanceof Timestamp) {
        createdAtString = createdAt.toDate().toISOString();
    } else if (typeof createdAt === 'string') {
        createdAtString = createdAt;
    }

    return {
        id: doc.id,
        name: data.name,
        url: data.url,
        fileKey: data.fileKey,
        groupKey: data.groupKey,
        padKey: data.padKey,
        createdAt: createdAtString,
    };
};


// Devuelve todos los samples para un grupo específico (ej: 'A')
export async function getSamplesByGroup(groupKey: string): Promise<{ success: boolean; samples?: Sample[], error?: string }> {
    try {
        const samplesCollection = collection(db, 'samples');
        const q = query(samplesCollection, where('groupKey', '==', groupKey));
        const samplesSnapshot = await getDocs(q);

        const samples: Sample[] = samplesSnapshot.docs.map(processSampleDoc);

        return { success: true, samples };
    } catch (error) {
        console.error(`Error obteniendo samples para el grupo ${groupKey}:`, error);
        return { success: false, error: (error as Error).message };
    }
}


// Guarda o actualiza un sample.
// Si el sample tiene un ID, lo actualiza.
// Si no, busca si ya existe un pad para ese grupo/tecla y lo actualiza, o crea uno nuevo.
export async function saveSample(data: Partial<Sample>): Promise<{ success: boolean, sample?: Sample, error?: string }> {
  try {
    const samplesCollection = collection(db, 'samples');
    
    // Hacemos una copia para no mutar el objeto original
    const dataToSave = { ...data };
    
    // Firestore no permite guardar 'undefined', así que lo eliminamos si existe.
    if (dataToSave.id === undefined) {
      delete dataToSave.id;
    }
     // Quitamos createdAt si es un string, Firestore debe manejarlo con serverTimestamp
    if (typeof dataToSave.createdAt === 'string') {
        delete dataToSave.createdAt;
    }
    
    if (dataToSave.id) {
      // Actualizar un sample existente por su ID
      const sampleRef = doc(db, 'samples', dataToSave.id);
      const { id, ...updateData } = dataToSave; // Extraemos el id para no guardarlo en el documento
      await updateDoc(sampleRef, updateData);
      
      const updatedSample: Sample = {
          ...(await getDoc(doc(db, 'samples', id))).data(),
          id: id
      } as Sample;

      return { success: true, sample: processSampleDoc({ id: id, data: () => updatedSample }) };
    } else {
      // Buscar si ya existe un pad para este group/pad
      const q = query(samplesCollection, where('groupKey', '==', dataToSave.groupKey), where('padKey', '==', dataToSave.padKey));
      const existingDocs = await getDocs(q);

      if (!existingDocs.empty) {
        // Si existe, actualizar el documento existente
        const existingDoc = existingDocs.docs[0];
        const sampleRef = doc(db, 'samples', existingDoc.id);
        const { id, ...updateData } = dataToSave;
        await updateDoc(sampleRef, updateData);
        
        const updatedDoc = await getDoc(sampleRef);
        return { success: true, sample: processSampleDoc(updatedDoc) };
      } else {
        // Si no existe, crear un nuevo documento
        const finalDocData = { ...dataToSave, createdAt: serverTimestamp() };
        const newDoc = await addDoc(samplesCollection, finalDocData);
        
        const savedDoc = await getDoc(newDoc);
        return { success: true, sample: processSampleDoc(savedDoc) };
      }
    }
  } catch (error) {
    console.error('Error guardando sample en Firestore:', error);
    return { success: false, error: (error as Error).message };
  }
}
