import { db, auth } from './firebase-config.js'; // Importamos auth
import { 
    collection, getDocs, doc, addDoc, updateDoc, getDoc, query, orderBy, where 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { 
    createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const COLLECTION_SERVICES = 'services'; // Los servicios son públicos para todos
const COLLECTION_ADDRESSES = 'addresses';
const COLLECTION_CONTRACTS = 'contracts';

export const DataService = {
    
    // --- AUTENTICACIÓN ---
    async register(email, password) {
        return createUserWithEmailAndPassword(auth, email, password);
    },

    async login(email, password) {
        return signInWithEmailAndPassword(auth, email, password);
    },

    async logout() {
        return signOut(auth);
    },

    getCurrentUser() {
        return auth.currentUser;
    },

    // --- DATOS ---

    async seedDataIfNeeded() {

        const snapshot = await getDocs(collection(db, COLLECTION_SERVICES));
        if (snapshot.empty) {

        }
    },

    async getAllData() {
        const user = auth.currentUser;
        if (!user) throw new Error("Usuario no autenticado");

        // AQUI ESTA LA CLAVE: Usamos 'where' para filtrar por el ID del usuario actual
        const [servicesSnap, addressesSnap, contractsSnap] = await Promise.all([
            getDocs(collection(db, COLLECTION_SERVICES)), // Servicios son globales
            getDocs(query(collection(db, COLLECTION_ADDRESSES), where("userId", "==", user.uid))),
            getDocs(query(collection(db, COLLECTION_CONTRACTS), where("userId", "==", user.uid)))
        ]);

        return {
            services: servicesSnap.docs.map(d => ({ id: d.id, ...d.data() })),
            addresses: addressesSnap.docs.map(d => ({ id: d.id, ...d.data() })),
            contracts: contractsSnap.docs.map(d => ({ id: d.id, ...d.data() }))
        };
    },

    async createContract(serviceIds, addressId) {
        const user = auth.currentUser;
        if (!user) throw new Error("Debes iniciar sesión");

        // ... lógica de obtener servicios y calcular total (igual que antes) ...
        const servicesSnap = await getDocs(collection(db, COLLECTION_SERVICES));
        const allServices = servicesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        const selectedServices = allServices.filter(s => serviceIds.includes(s.id));
        
        // Validar que la dirección pertenezca al usuario
        const addrRef = doc(db, COLLECTION_ADDRESSES, addressId);
        const addrSnap = await getDoc(addrRef);
        if (!addrSnap.exists() || addrSnap.data().userId !== user.uid) {
            throw new Error("Dirección inválida");
        }

        const totalPrice = selectedServices.reduce((sum, s) => sum + s.price, 0);
        const startDate = new Date();
        const endDate = new Date();
        endDate.setFullYear(endDate.getFullYear() + 1);

        const newContract = {
            userId: user.uid, // GUARDAMOS A QUIEN PERTENECE
            userEmail: user.email,
            status: 'Activo',
            services: selectedServices,
            addressAlias: addrSnap.data().alias,
            addressId: addressId,
            totalPrice: totalPrice,
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString()
        };

        const docRef = await addDoc(collection(db, COLLECTION_CONTRACTS), newContract);
        return { id: docRef.id, ...newContract };
    },

    async renewContract(contractId) {

        const contractRef = doc(db, COLLECTION_CONTRACTS, contractId);
        const contractSnap = await getDoc(contractRef);
        const currentEnd = new Date(contractSnap.data().endDate);
        const newEnd = new Date(currentEnd.setFullYear(currentEnd.getFullYear() + 1));
        await updateDoc(contractRef, { endDate: newEnd.toISOString(), status: 'Renovado' });
    },

    async createAddress(payload) {
        const user = auth.currentUser;
        if (!user) throw new Error("No autenticado");

        const newAddr = { 
            ...payload, 
            userId: user.uid, // ASIGNAMOS PROPIETARIO
            createdAt: new Date() 
        };
        await addDoc(collection(db, COLLECTION_ADDRESSES), newAddr);
    }
};