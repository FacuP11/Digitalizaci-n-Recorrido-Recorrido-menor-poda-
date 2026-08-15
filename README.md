# ⚡ Digitalización e Inspección de Recorridos de Alta Tensión (v2.0)

Sistema Full Stack diseñado para la digitalización técnica, relevamiento en campo y generación automatizada de informes de inspección para líneas aéreas de Alta Tensión (132 kV / 220 kV).

**Autor:** Facundo Martin Ponce Britos  
**Versión:** 2.0.0 (Versión Oficial)

---

## 📌 Características Principales

- **Gestión Integral de Trazas:** Configuración de recorridos con secuencia física real ($\text{POR} \rightarrow \text{ANT} \rightarrow \text{Piquetes} \rightarrow \text{ANT} \rightarrow \text{POR}$) en subida o bajada.
- **Soporte para Doble Terna:** Creación y vinculación de líneas paralelas con asignación independiente de Órdenes de Trabajo (OT).
- **Inspección Técnica Especializada:**
  - **Aisladores:** Registro por fase ($R, S, T$) para cadenas dobles ($SD, SV, RD$ con ramas Int/Ext), simples ($SS, RS$) y cadenas colgantes de puente / cuello muerto ($SCM$).
  - **Orientación de Retenciones:** Asignación de lado de referencia ($Subestación\ A / B$) exclusiva para estructuras $RS$ y $RD$.
  - **Poda:** Clasificación por urgencia ($Inmediata, Urgente, Corto\ Plazo, Sin\ Plazo$), medio operativo ($Hidroelevador, Trepa, L.\ Viva$) y conteo de árboles.
  - **Conductores, Torres y Columnas:** Registro detallado de anomalías electromecánicas.
- **Reportes Automatizados:** Generación y descarga directa de planillas técnicas en formato Excel (`.xlsx`) mediante `ExcelJS`, agrupadas por piquete y ordenadas por nivel de prioridad.
- **Diseño Adaptativo de Alto Contraste:** Interfaz táctil ergonómica con soporte para modo claro/oscuro pensada para dispositivos móviles y tablets en campo.

---

## 🛠️ Stack Tecnológico

- **Frontend:** React 18, Vite, Tailwind CSS v4, React Router DOM.
- **Backend:** Node.js (ES Modules), Express.js.
- **Base de Datos:** PostgreSQL con Sequelize ORM.
- **Generación de Reportes:** ExcelJS.

---

## 🚀 Instalación y Puesta en Marcha

### 1. Clonar el repositorio
```bash
git clone [https://github.com/FacuP11/Digitalizaci-n-Recorrido-Recorrido-menor-poda-.git](https://github.com/FacuP11/Digitalizaci-n-Recorrido-Recorrido-menor-poda-.git)
cd Digitalizaci-n-Recorrido-Recorrido-menor-poda-

### 2. Backend
Bash
cd backend
npm install
cp .env.example .env   # Configurar credenciales de PostgreSQL
npm run dev

### 3. Frontend
Bash
cd ../frontend
npm install                                                                 

---

### 3. Comandos de Git para Publicar la Versión 2.0
Abre la terminal en la carpeta principal de tu proyecto y ejecuta la siguiente secuencia:

```bash
# 1. Comprobar estado de archivos
git status

# 2. Agregar todos los cambios
git add .

# 3. Crear el commit oficial de la versión 2.0
git commit -m "feat: release v2.0.0 - Sistema Oficial de Digitalización de Recorridos de Alta Tensión"

# 4. Crear una etiqueta (tag) de versión
git tag -a v2.0.0 -m "Versión 2.0.0 - Lanzamiento oficial"

# 5. Subir los cambios y los tags a GitHub
git push origin main --tags
# (o 'git push origin master --tags' según el nombre de tu rama principal)