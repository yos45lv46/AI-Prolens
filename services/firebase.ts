
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, onSnapshot, deleteDoc, doc, updateDoc, serverTimestamp, query, orderBy } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { LearningMaterial } from '../types';

// --- הוראות למנהל המערכת ---
// 1. לך אל: https://console.firebase.google.com/
// 2. צור פרויקט חדש.
// 3. הוסף אפליקציית Web.
// 4. העתק את ה-firebaseConfig שקיבלת והדבק אותו כאן במקום האובייקט הריק.
// 5. ב-Firestore Database, צור Database והגדר את ה-Rules ל-Test Mode (או אפשר קריאה/כתיבה לכולם בהתחלה).
// 6. ב-Storage, הפעל את השירות והגדר Rules דומים.

const firebaseConfig = {
  // הדבק את ההגדרות שלך כאן:
  apiKey: "YOUR_API_KEY_HERE",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "...",
  appId: "..."
};

// Check if config is set
export const isFirebaseConfigured = () => {
  return firebaseConfig.apiKey !== "YOUR_API_KEY_HERE";
};

let db: any;
let storage: any;

try {
  if (isFirebaseConfigured()) {
    const app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    storage = getStorage(app);
  }
} catch (error) {
  console.error("Firebase init error:", error);
}

export const subscribeToMaterials = (callback: (materials: LearningMaterial[]) => void) => {
  if (!db) return () => {};

  const q = query(collection(db, 'materials'), orderBy('createdAt', 'desc'));
  
  return onSnapshot(q, (snapshot) => {
    const materials = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as LearningMaterial[];
    callback(materials);
  }, (error) => {
    console.error("Error fetching materials:", error);
  });
};

export const uploadFileToCloud = async (file: File): Promise<string> => {
  if (!storage) throw new Error("Firebase storage not configured");
  
  const storageRef = ref(storage, `materials/${Date.now()}_${file.name}`);
  const snapshot = await uploadBytes(storageRef, file);
  const downloadURL = await getDownloadURL(snapshot.ref);
  return downloadURL;
};

export const addMaterialToCloud = async (material: Omit<LearningMaterial, 'id'>) => {
  if (!db) throw new Error("Firebase DB not configured");
  
  await addDoc(collection(db, 'materials'), {
    ...material,
    createdAt: serverTimestamp()
  });
};

export const deleteMaterialFromCloud = async (id: string, fileUrl?: string) => {
  if (!db) throw new Error("Firebase DB not configured");

  // 1. Delete from Firestore
  await deleteDoc(doc(db, 'materials', id));

  // 2. Delete from Storage if it's a file (and not a text guide/link)
  if (fileUrl && fileUrl.includes('firebasestorage') && storage) {
    try {
      // Create a reference from the URL
      const storageRef = ref(storage, fileUrl);
      await deleteObject(storageRef);
    } catch (e) {
      console.error("Error deleting file from storage:", e);
    }
  }
};

export const updateMaterialAnalysis = async (id: string, isAnalyzed: boolean) => {
    if (!db) return;
    const materialRef = doc(db, 'materials', id);
    await updateDoc(materialRef, { isAnalyzed });
};
