import { DataService } from './data-service.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { auth } from './firebase-config.js'; // Necesitamos auth para el listener

const Frontend = {
    state: {
        view: 'home',
        data: null,
        selectedServiceIds: new Set(),
        tempTotal: 0,
        isRegistering: false // Nuevo estado para alternar Login/Registro
    },

    init() {
        // Listener Global de Autenticación
        onAuthStateChanged(auth, async (user) => {
            if (user) {
                // USUARIO LOGUEADO
                document.getElementById('auth-screen').classList.add('hidden');
                document.getElementById('main-app').classList.remove('hidden');
                document.getElementById('user-email-display').innerText = user.email;
                
                await this.refresh(); // Cargar datos DEL USUARIO
                this.navigate('home');
            } else {
                // USUARIO DESLOGUEADO
                document.getElementById('auth-screen').classList.remove('hidden');
                document.getElementById('main-app').classList.add('hidden');
                this.state.data = null;
            }
            if(window.lucide) window.lucide.createIcons();
        });

        this.setupAuthListeners();
        
        // Eventos generales
        document.getElementById('nav-home-btn').onclick = () => this.navigate('home');
    },

    setupAuthListeners() {
        // Toggle Login / Registro
        const toggleBtn = document.getElementById('auth-toggle-btn');
        const modeText = document.getElementById('auth-mode-text');
        const submitBtn = document.getElementById('auth-submit-btn');
        const errorDiv = document.getElementById('auth-error');

        toggleBtn.onclick = (e) => {
            e.preventDefault();
            this.state.isRegistering = !this.state.isRegistering;
            if (this.state.isRegistering) {
                modeText.innerText = "¿Ya tienes cuenta?";
                toggleBtn.innerText = "Inicia sesión";
                submitBtn.innerText = "Crear Cuenta";
            } else {
                modeText.innerText = "¿No tienes cuenta?";
                toggleBtn.innerText = "Regístrate aquí";
                submitBtn.innerText = "Iniciar Sesión";
            }
            errorDiv.classList.add('hidden');
        };

        // Submit Form
        document.getElementById('auth-form').onsubmit = async (e) => {
            e.preventDefault();
            const email = e.target.email.value;
            const password = e.target.password.value;
            errorDiv.classList.add('hidden');
            submitBtn.disabled = true;
            submitBtn.innerText = "Cargando...";

            try {
                if (this.state.isRegistering) {
                    await DataService.register(email, password);
                    this.toast("Cuenta creada exitosamente");
                } else {
                    await DataService.login(email, password);
                    this.toast("Bienvenido de nuevo");
                }
                // onAuthStateChanged se encargará del resto
            } catch (error) {
                console.error(error);
                let msg = "Error de autenticación";
                if (error.code === 'auth/invalid-credential') msg = "Correo o contraseña incorrectos";
                if (error.code === 'auth/email-already-in-use') msg = "Este correo ya está registrado";
                if (error.code === 'auth/weak-password') msg = "La contraseña debe tener al menos 6 caracteres";
                
                errorDiv.innerText = msg;
                errorDiv.classList.remove('hidden');
                submitBtn.disabled = false;
                submitBtn.innerText = this.state.isRegistering ? "Crear Cuenta" : "Iniciar Sesión";
            }
        };
    },

    async handleLogout() {
        try {
            await DataService.logout();
            this.toast("Sesión cerrada");
        } catch(e) { console.error(e); }
    },

    async refresh() {
        try {
            const data = await DataService.getAllData();
            this.state.data = data;
        } catch (e) {
            console.error("Error cargando datos:", e);
        }
    },

    navigate(view) {
        this.state.view = view;
        if(view === 'new-contract') {
            this.state.selectedServiceIds.clear();
            this.state.tempTotal = 0;
        }
        this.render();
        window.scrollTo(0, 0);
        if(window.lucide) window.lucide.createIcons();
    },

    toggleService(serviceId, price) {
        if (this.state.selectedServiceIds.has(serviceId)) {
            this.state.selectedServiceIds.delete(serviceId);
            this.state.tempTotal -= price;
        } else {
            this.state.selectedServiceIds.add(serviceId);
            this.state.tempTotal += price;
        }
        document.getElementById('total-counter').innerText = this.formatPrice(this.state.tempTotal);
        
        const btn = document.getElementById('btn-create-contract');
        if(this.state.selectedServiceIds.size > 0) {
            btn.disabled = false;
            btn.classList.remove('opacity-50', 'cursor-not-allowed');
        } else {
            btn.disabled = true;
            btn.classList.add('opacity-50', 'cursor-not-allowed');
        }
    },

    async handleCreateContract(e) {
        e.preventDefault();
        const form = new FormData(e.target);
        const addressId = form.get('address');

        if (!addressId) return this.toast("Seleccione una dirección", "error");
        this.setLoading(true, e.target);

        try {
            await DataService.createContract(
                Array.from(this.state.selectedServiceIds),
                addressId
            );
            await this.refresh();
            this.toast("Contrato guardado en tu cuenta");
            this.navigate('my-contracts');
        } catch (err) {
            console.error(err);
            this.toast("Error al crear contrato", "error");
        } finally {
            this.setLoading(false);
        }
    },
    
    async viewContractDetails(contractId) {
        const contract = this.state.data.contracts.find(c => c.id === contractId);
        const content = document.getElementById('modal-content');
        document.getElementById('modal-overlay').classList.remove('hidden');
        content.innerHTML = Views.contractDetailsModal(contract);
        window.lucide.createIcons();
    },

    async renewContract(contractId, btn) {
        const originalText = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = `<div class="loader inline-block align-middle w-4 h-4 border-white mr-2"></div> Renovando...`;

        try {
            await DataService.renewContract(contractId);
            await this.refresh();
            this.toast("Renovado exitosamente");
            this.closeModal();
            this.navigate('my-contracts');
        } catch (e) {
            console.error(e);
            this.toast("Error al renovar", "error");
        } finally {
            if(btn) { btn.disabled = false; btn.innerHTML = originalText; }
        }
    },

    async handleAddressSubmit(e) {
        e.preventDefault();
        const form = Object.fromEntries(new FormData(e.target));
        this.setLoading(true, e.target);
        try {
            await DataService.createAddress(form);
            await this.refresh();
            this.toast("Dirección guardada");
            this.navigate('new-contract');
        } catch (e) {
            this.toast("Error al guardar dirección", "error");
            this.setLoading(false);
        }
    },

    closeModal() {
        document.getElementById('modal-overlay').classList.add('hidden');
    },

    setLoading(loading, form) {
        const btn = form?.querySelector('button[type="submit"]');
        if (btn) {
            btn.disabled = loading;
            btn.innerHTML = loading ? 'Procesando...' : 'Confirmar';
        }
    },
    toast(msg, type='success') {
        const el = document.createElement('div');
        el.className = `${type === 'success' ? 'bg-emerald-600' : 'bg-red-600'} text-white px-4 py-3 rounded shadow-lg fade-in`;
        el.innerText = msg;
        document.getElementById('toast-container').appendChild(el);
        setTimeout(() => el.remove(), 3000);
    },
    formatPrice(p) { return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(p); },
    formatDate(iso) { return new Date(iso).toLocaleDateString('es-CL', { year: 'numeric', month: 'long', day: 'numeric' }); },
    
    handlePanic() {
        this.toast("🚨 ¡ALERTA ENVIADA! Unidades de respuesta notificadas.", "error");

    },

    render() {
        const root = document.getElementById('app-root');
        if (!this.state.data) return;

        switch(this.state.view) {
            case 'home': root.innerHTML = Views.home(this.state.data); break;
            case 'new-contract': root.innerHTML = Views.newContract(this.state.data, this.state); break;
            case 'my-contracts': root.innerHTML = Views.contracts(this.state.data); break;
            case 'new-address': root.innerHTML = Views.addressForm(); break;
        }
    }
};


const Views = {
    home: (data) => `
        <div class="space-y-6 fade-in">
            <div class="bg-slate-900 text-white rounded-3xl p-8 shadow-xl relative overflow-hidden">
                <div class="relative z-10">
                    <h1 class="text-3xl font-bold mb-2">Panel de Control</h1>
                    <p class="text-slate-400 mb-6">Gestiona tus servicios de seguridad.</p>
                    <div class="flex gap-4">
                        <button onclick="Frontend.navigate('new-contract')" class="bg-blue-600 hover:bg-blue-500 px-6 py-3 rounded-xl font-bold flex items-center transition">
                            <i data-lucide="plus-circle" class="w-5 h-5 mr-2"></i> Contratar
                        </button>
                        <button onclick="Frontend.navigate('my-contracts')" class="bg-white/10 hover:bg-white/20 px-6 py-3 rounded-xl font-bold flex items-center transition">
                            <i data-lucide="file-text" class="w-5 h-5 mr-2"></i> Mis Contratos
                        </button>
                    </div>
                </div>
                <i data-lucide="shield" class="absolute -right-12 -bottom-24 w-80 h-80 text-slate-800 rotate-12"></i>
            </div>

            <button onclick="Frontend.handlePanic()" class="w-full group bg-red-600 hover:bg-red-700 text-white rounded-2xl p-6 shadow-lg shadow-red-200 flex items-center justify-between transition-all transform hover:scale-[1.01]">
                <div class="flex items-center">
                    <div class="bg-white/20 p-3 rounded-full mr-4 group-hover:animate-pulse">
                        <i data-lucide="bell-ring" class="w-8 h-8 text-white"></i>
                    </div>
                    <div class="text-left">
                        <h3 class="text-2xl font-bold">SOS / EMERGENCIA</h3>
                        <p class="text-red-100 text-sm">Solicitar asistencia inmediata a central.</p>
                    </div>
                </div>
                <div class="bg-red-800/50 p-2 rounded-full">
                    <i data-lucide="chevron-right" class="w-6 h-6"></i>
                </div>
            </button>

            <div class="grid md:grid-cols-2 gap-6">
                <div class="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                    <h3 class="font-bold text-slate-700 mb-4 flex items-center"><i data-lucide="map-pin" class="w-4 h-4 mr-2"></i> Direcciones</h3>
                    ${data.addresses.length ? data.addresses.map(a => `<div class="p-3 bg-slate-50 rounded-lg mb-2 text-sm font-medium flex justify-between"><span>${a.alias}</span> <span class="text-slate-400 font-normal truncate max-w-[150px]">${a.street}</span></div>`).join('') : '<p class="text-sm text-slate-400">Sin direcciones.</p>'}
                </div>
                 <div class="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
                    <div>
                        <h3 class="font-bold text-slate-700">Contratos Activos</h3>
                        <div class="text-4xl font-bold text-blue-600 mt-2">${data.contracts.length}</div>
                    </div>
                    <div class="bg-blue-50 p-4 rounded-full"><i data-lucide="file-check" class="w-8 h-8 text-blue-600"></i></div>
                </div>
            </div>
        </div>
    `,
    newContract: (data, state) => `
        <div class="max-w-3xl mx-auto fade-in">
            <div class="flex items-center mb-6">
                <button onclick="Frontend.navigate('home')" class="mr-4 p-2 rounded-full hover:bg-slate-100"><i data-lucide="arrow-left"></i></button>
                <h2 class="text-2xl font-bold">Crear Nuevo Contrato</h2>
            </div>

            <form onsubmit="Frontend.handleCreateContract(event)" class="space-y-6">
                <div class="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                    <h3 class="font-bold text-slate-400 uppercase text-xs mb-4">1. Selecciona Servicios</h3>
                    <div class="grid gap-3">
                        ${data.services.map(srv => `
                            <label class="relative cursor-pointer group">
                                <input type="checkbox" class="sr-only service-checkbox" 
                                    onchange="Frontend.toggleService('${srv.id}', ${srv.price})" ${state.selectedServiceIds.has(srv.id) ? 'checked' : ''}>
                                <div class="flex items-center p-4 border-2 border-slate-100 rounded-xl hover:border-blue-200 transition bg-white group-hover:bg-slate-50">
                                    <div class="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 mr-4">
                                        <i data-lucide="${srv.icon}" class="w-5 h-5"></i>
                                    </div>
                                    <div class="flex-1">
                                        <div class="flex justify-between">
                                            <span class="font-bold text-slate-900">${srv.name}</span>
                                            <span class="font-bold text-blue-600">${Frontend.formatPrice(srv.price)}</span>
                                        </div>
                                        <p class="text-xs text-slate-500">${srv.desc}</p>
                                    </div>
                                    <div class="check-icon absolute top-4 right-4 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center opacity-0 transform scale-50 transition-all duration-200">
                                        <i data-lucide="check" class="w-4 h-4"></i>
                                    </div>
                                </div>
                            </label>
                        `).join('')}
                    </div>
                </div>

                <div class="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                    <div class="flex justify-between items-center mb-4">
                        <h3 class="font-bold text-slate-400 uppercase text-xs">2. Selecciona Ubicación</h3>
                        <button type="button" onclick="Frontend.navigate('new-address')" class="text-xs text-blue-600 font-bold hover:underline">+ Nueva</button>
                    </div>
                    <div class="grid md:grid-cols-2 gap-3">
                        ${data.addresses.length > 0 ? data.addresses.map(addr => `
                            <label class="cursor-pointer">
                                <input type="radio" name="address" value="${addr.id}" class="sr-only peer" required>
                                <div class="p-4 border-2 border-slate-100 rounded-xl peer-checked:border-blue-600 peer-checked:bg-blue-50 hover:bg-slate-50 transition h-full">
                                    <div class="font-bold text-sm mb-1">${addr.alias}</div>
                                    <div class="text-xs text-slate-500">${addr.street}</div>
                                </div>
                            </label>
                        `).join('') : '<div class="col-span-2 text-sm text-slate-400 italic">No tienes direcciones registradas.</div>'}
                    </div>
                </div>

                <div class="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 p-4 shadow-lg md:relative md:rounded-2xl md:shadow-none md:border-none md:p-0 md:bg-transparent">
                    <div class="max-w-5xl mx-auto flex items-center justify-between">
                        <div>
                            <p class="text-xs text-slate-500 font-bold uppercase">Total Estimado</p>
                            <p class="text-2xl font-bold text-slate-900" id="total-counter">${Frontend.formatPrice(state.tempTotal)}</p>
                        </div>
                        <button id="btn-create-contract" type="submit" ${state.selectedServiceIds.size === 0 ? 'disabled' : ''} class="bg-slate-900 text-white px-8 py-3 rounded-xl font-bold ${state.selectedServiceIds.size === 0 ? 'opacity-50 cursor-not-allowed' : ''} transition hover:bg-slate-800">
                            Confirmar Contrato
                        </button>
                    </div>
                </div>
            </form>
            <div class="h-20 md:h-0"></div>
        </div>
    `,
    contracts: (data) => `
        <div class="fade-in">
            <div class="flex items-center mb-6">
                <button onclick="Frontend.navigate('home')" class="mr-4 p-2 rounded-full hover:bg-slate-100"><i data-lucide="arrow-left"></i></button>
                <h2 class="text-2xl font-bold">Mis Contratos</h2>
            </div>
            <div class="grid gap-4">
                ${data.contracts.length === 0 ? '<div class="text-slate-500 text-center py-10">No hay contratos activos.</div>' : ''}
                ${data.contracts.map(c => `
                    <div class="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition">
                        <div class="flex justify-between items-start mb-4">
                            <div>
                                <span class="inline-block px-2 py-1 rounded text-xs font-bold mb-2 ${c.status === 'Activo' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}">${c.status}</span>
                                <div class="text-xs text-slate-400 font-mono mb-1">ID: ${c.id.substring(0,8)}...</div>
                                <div class="font-bold text-lg text-slate-900">
                                    ${c.services.length} Servicio(s) Contratado(s)
                                </div>
                            </div>
                            <div class="text-right">
                                <div class="font-bold text-slate-900 text-lg">${Frontend.formatPrice(c.totalPrice)}</div>
                                <div class="text-xs text-slate-500">Total</div>
                            </div>
                        </div>
                        <div class="flex items-center justify-between border-t border-slate-100 pt-4">
                            <div class="text-sm text-slate-600"><i data-lucide="map-pin" class="inline w-4 h-4 mr-1"></i> ${c.addressAlias}</div>
                            <button onclick="Frontend.viewContractDetails('${c.id}')" class="text-blue-600 font-bold text-sm hover:underline">
                                Ver Detalles & Fechas
                            </button>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    `,
    addressForm: () => `
        <div class="max-w-xl mx-auto fade-in">
            <div class="flex items-center mb-6">
                <button onclick="Frontend.navigate('new-contract')" class="mr-4 p-2 rounded-full hover:bg-slate-100"><i data-lucide="arrow-left"></i></button>
                <h2 class="text-2xl font-bold">Nueva Dirección</h2>
            </div>
            <form onsubmit="Frontend.handleAddressSubmit(event)" class="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                <input name="alias" class="w-full p-3 border rounded-lg" placeholder="Alias (Ej: Oficina)" required>
                <input name="street" class="w-full p-3 border rounded-lg" placeholder="Dirección Completa" required>
                <input name="city" class="w-full p-3 border rounded-lg" placeholder="Ciudad" required>
                <button type="submit" class="w-full bg-blue-600 text-white py-3 rounded-lg font-bold">Guardar</button>
            </form>
        </div>
    `,
    contractDetailsModal: (c) => `
        <div class="bg-blue-600 p-6 text-white relative">
            <button onclick="Frontend.closeModal()" class="absolute top-4 right-4 p-2 hover:bg-blue-500 rounded-full"><i data-lucide="x" class="w-5 h-5"></i></button>
            <div class="text-xs opacity-75 font-mono mb-1">CONTRATO #${c.id.substring(0,8)}</div>
            <h2 class="text-2xl font-bold">Detalles del Servicio</h2>
        </div>
        <div class="p-6">
            <div class="grid grid-cols-2 gap-4 mb-6 bg-slate-50 p-4 rounded-xl border border-slate-100">
                <div>
                    <div class="text-xs text-slate-500 font-bold uppercase">Fecha Inicio</div>
                    <div class="font-medium text-slate-900">${Frontend.formatDate(c.startDate)}</div>
                </div>
                <div>
                    <div class="text-xs text-slate-500 font-bold uppercase">Fecha Fin</div>
                    <div class="font-bold text-blue-600">${Frontend.formatDate(c.endDate)}</div>
                </div>
            </div>

            <h3 class="font-bold text-slate-700 text-sm mb-3">Servicios Incluidos</h3>
            <ul class="space-y-2 mb-6">
                ${c.services.map(s => `
                    <li class="flex justify-between text-sm p-2 border-b border-slate-100 last:border-0">
                        <span class="text-slate-600 flex items-center"><i data-lucide="${s.icon}" class="w-4 h-4 mr-2 text-slate-400"></i> ${s.name}</span>
                        <span class="font-medium">${Frontend.formatPrice(s.price)}</span>
                    </li>
                `).join('')}
            </ul>

            <div class="flex justify-between items-center pt-4 border-t border-slate-100 mb-6">
                <span class="font-bold text-lg">Total</span>
                <span class="font-bold text-xl text-blue-600">${Frontend.formatPrice(c.totalPrice)}</span>
            </div>

            <button onclick="Frontend.renewContract('${c.id}', this)" class="w-full py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition shadow-lg flex justify-center items-center">
                <i data-lucide="refresh-cw" class="w-4 h-4 mr-2"></i> Renovar Contrato (+1 Año)
            </button>
        </div>
    `
};

window.Frontend = Frontend;
Frontend.init();