import React, { useState, useEffect } from "react";
import { db } from './firebaseConfig';
import { collection, onSnapshot, addDoc, query, where, getDocs, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import './registro.css'

const Registro = ({ onBack }) => {
  const [registroForm, setRegistroForm] = useState({
    empresa: "",
    mes: "",
    año: "",
    datos: [{ 
      detalle: "", 
      tipo: "", 
      tipoTransaccion: "debe", // Por defecto "debe"
      monto: "",
      observacion: "" // Campo para observaciones
    }],
    total: 0
  });
  const [empresas, setEmpresas] = useState([]);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [notification, setNotification] = useState({ show: false, message: "", type: "" });
  const [tiposUsados, setTiposUsados] = useState(new Set()); // Conjunto para rastrear tipos ya usados
  const [existingRegistrosIds, setExistingRegistrosIds] = useState([]); // Para almacenar IDs de registros existentes
  const [isEditing, setIsEditing] = useState(false); // Para saber si estamos editando o creando nuevo
  const [newTipoInput, setNewTipoInput] = useState(""); // Nuevo estado para el input de nuevo tipo
  const [showNewTipoInput, setShowNewTipoInput] = useState(false); // Estado para mostrar/ocultar el input
  const [customTipos, setCustomTipos] = useState([]); // Estado para almacenar tipos personalizados por empresa

  const meses = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
  ];

  const tiposBase = [
    "Caja", "Ingreso", "Costo", "IVA", "PPM", "Ajuste CF", 
    "Retencion SC", "Honorarios", "Gastos Generales", "Cuentas Varias"
  ];

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'empresas'), (snapshot) => {
      const fetchedEmpresas = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setEmpresas(fetchedEmpresas);
    });

    return () => unsubscribe();
  }, []);

  // Cargar tipos personalizados cuando cambia la empresa seleccionada
  useEffect(() => {
    if (registroForm.empresa) {
      const empresaSeleccionada = empresas.find(e => e.nombre === registroForm.empresa);
      if (empresaSeleccionada) {
        // Cargar tipos personalizados de la empresa
        const tiposPersonalizados = empresaSeleccionada.tipos_personalizados || [];
        setCustomTipos(tiposPersonalizados);
      }
    } else {
      setCustomTipos([]);
    }
  }, [registroForm.empresa, empresas]);

  useEffect(() => {
    if (notification.show) {
      const timer = setTimeout(() => {
        setNotification({ show: false, message: "", type: "" });
      }, 3000);
      
      return () => clearTimeout(timer);
    }
  }, [notification.show]);

  // Actualizar tiposUsados cuando cambian los datos
  useEffect(() => {
    const usados = new Set();
    registroForm.datos.forEach(dato => {
      if (dato.tipo && dato.tipo !== "Cuentas Varias") {
        usados.add(dato.tipo);
      }
    });
    setTiposUsados(usados);
  }, [registroForm.datos]);

  // Buscar registros existentes cuando se actualiza empresa, mes, año y detalle
  useEffect(() => {
    if (registroForm.empresa && registroForm.mes && registroForm.año && registroForm.datos[0].detalle) {
      buscarRegistrosExistentes();
    }
  }, [registroForm.empresa, registroForm.mes, registroForm.año, registroForm.datos[0].detalle]);

  // Función para buscar registros existentes
  const buscarRegistrosExistentes = async () => {
    if (!registroForm.empresa || !registroForm.mes || !registroForm.año || !registroForm.datos[0].detalle) {
      return;
    }

    setSearchLoading(true);
    try {
      const q = query(
        collection(db, 'registros'),
        where('empresa', '==', registroForm.empresa),
        where('mes', '==', registroForm.mes),
        where('año', '==', registroForm.año)
      );

      const querySnapshot = await getDocs(q);
      const matchingRegistros = [];

      querySnapshot.forEach((doc) => {
        const registro = { id: doc.id, ...doc.data() };
        // Solo considerar registros cuyo detalle coincida con el primer dato
        if (registro.datos[0]?.detalle === registroForm.datos[0].detalle) {
          matchingRegistros.push(registro);
        }
      });

      if (matchingRegistros.length > 0) {
        // Encontramos un registro que coincide
        const registro = matchingRegistros[0];
        
        // Guardar los IDs de los registros a sobrescribir
        const registroIds = [registro.id];
        
        // Buscar entradas correspondientes en colecciones debe/haber
        const debeQuery = query(
          collection(db, 'debe'),
          where('empresa', '==', registro.empresa),
          where('mes', '==', registro.mes),
          where('año', '==', registro.año),
          where('detalle', '==', registro.datos[0].detalle)
        );
        
        const haberQuery = query(
          collection(db, 'haber'),
          where('empresa', '==', registro.empresa),
          where('mes', '==', registro.mes),
          where('año', '==', registro.año),
          where('detalle', '==', registro.datos[0].detalle)
        );
        
        const [debeSnapshot, haberSnapshot] = await Promise.all([
          getDocs(debeQuery),
          getDocs(haberQuery)
        ]);
        
        debeSnapshot.forEach(doc => {
          registroIds.push({ id: doc.id, collection: 'debe' });
        });
        
        haberSnapshot.forEach(doc => {
          registroIds.push({ id: doc.id, collection: 'haber' });
        });
        
        setExistingRegistrosIds(registroIds);
        
        // Actualizar el formulario con los datos existentes
        setRegistroForm({
          empresa: registro.empresa,
          mes: registro.mes,
          año: registro.año,
          datos: registro.datos,
          total: registro.total
        });
        
        setIsEditing(true);
        
        setNotification({
          show: true,
          message: "Se encontró un registro existente. Se han cargado los datos para edición.",
          type: "info"
        });
      } else {
        setIsEditing(false);
        setExistingRegistrosIds([]);
      }
    } catch (error) {
      console.error("Error al buscar registros existentes:", error);
    } finally {
      setSearchLoading(false);
    }
  };

  // Función para agregar un nuevo tipo personalizado
  const handleAddNewTipo = async () => {
    if (!newTipoInput.trim()) {
      setNotification({
        show: true,
        message: "Ingrese un nombre para el nuevo tipo",
        type: "error"
      });
      return;
    }

    if (!registroForm.empresa) {
      setNotification({
        show: true,
        message: "Debe seleccionar una empresa primero",
        type: "error"
      });
      return;
    }

    // Verificar si el tipo ya existe (en base o personalizados)
    const allTipos = [...tiposBase, ...customTipos];
    if (allTipos.includes(newTipoInput.trim())) {
      setNotification({
        show: true,
        message: "Este tipo ya existe",
        type: "error"
      });
      return;
    }

    try {
      // Buscar el documento de la empresa seleccionada
      const empresaSeleccionada = empresas.find(e => e.nombre === registroForm.empresa);
      
      if (empresaSeleccionada) {
        const empresaDocRef = doc(db, 'empresas', empresaSeleccionada.id);
        
        // Obtener los tipos personalizados actuales o inicializar como array vacío
        const tiposActuales = empresaSeleccionada.tipos_personalizados || [];
        
        // Agregar el nuevo tipo
        const nuevosTipos = [...tiposActuales, newTipoInput.trim()];
        
        // Actualizar el documento de la empresa
        await updateDoc(empresaDocRef, {
          tipos_personalizados: nuevosTipos
        });
        
        // Actualizar el estado local
        setCustomTipos(nuevosTipos);
        setNewTipoInput("");
        setShowNewTipoInput(false);
        
        setNotification({
          show: true,
          message: "Nuevo tipo agregado correctamente",
          type: "success"
        });
      }
    } catch (error) {
      console.error("Error al agregar nuevo tipo:", error);
      setNotification({
        show: true,
        message: "Error al agregar el nuevo tipo: " + error.message,
        type: "error"
      });
    }
  };

  const calculateTotal = (datos) => {
    let total = 0;
    
    datos.forEach(dato => {
      const monto = parseFloat(dato.monto) || 0;
      if (dato.tipoTransaccion === 'debe') {
        total += monto;
      } else {
        total -= monto;
      }
    });
    
    return total;
  };

  // Calcular totales separados para debe y haber
  const calculateTotals = (datos) => {
    let totalDebe = 0;
    let totalHaber = 0;
    
    datos.forEach(dato => {
      const monto = parseFloat(dato.monto) || 0;
      if (dato.tipoTransaccion === 'debe') {
        totalDebe += monto;
      } else {
        totalHaber += monto;
      }
    });
    
    return { totalDebe, totalHaber };
  };

  const validateForm = () => {
    const newErrors = {};

    if (!registroForm.empresa) newErrors.empresa = "Seleccione una empresa";
    if (!registroForm.mes) newErrors.mes = "Seleccione un mes";
    if (!registroForm.año) newErrors.año = "Ingrese el año";

    registroForm.datos.forEach((dato, index) => {
      if (!dato.detalle) {
        newErrors[`detalle${index}`] = "Complete el campo de detalle";
      }
      if (!dato.tipo) {
        newErrors[`tipo${index}`] = "Seleccione el tipo";
      }
      if (!dato.monto) {
        newErrors[`monto${index}`] = "Ingrese el monto";
      }
      // Validar observación si es Cuentas Varias
      if (dato.tipo === "Cuentas Varias" && !dato.observacion) {
        newErrors[`observacion${index}`] = "Ingrese una observación para Cuentas Varias";
      }
    });

    // Validar balance de debe y haber
    const { totalDebe, totalHaber } = calculateTotals(registroForm.datos);
    const hasDebe = registroForm.datos.some(dato => dato.tipoTransaccion === 'debe');
    const hasHaber = registroForm.datos.some(dato => dato.tipoTransaccion === 'haber');

    if (hasDebe && hasHaber && Math.abs(totalDebe - totalHaber) > 0.01) {
      newErrors.balance = "El total de DEBE y HABER deben ser iguales";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      setNotification({
        show: true,
        message: "Por favor, complete todos los campos requeridos",
        type: "error"
      });
      return;
    }

    setLoading(true);

    const { totalDebe, totalHaber } = calculateTotals(registroForm.datos);
    const total = calculateTotal(registroForm.datos);
    
    // Determinar el valor de control automáticamente
    let controlValue;
    const hasDebe = registroForm.datos.some(dato => dato.tipoTransaccion === 'debe');
    const hasHaber = registroForm.datos.some(dato => dato.tipoTransaccion === 'haber');
    
    if (hasDebe && hasHaber) {
      // Si hay debe y haber, el control es cualquiera de los dos (son iguales)
      controlValue = totalDebe;
    } else if (hasDebe) {
      // Si solo hay debe, el control es la suma de todos los debe
      controlValue = totalDebe;
    } else {
      // Si solo hay haber, el control es la suma de todos los haber
      controlValue = totalHaber;
    }

    const newTransaction = {
      empresa: registroForm.empresa,
      mes: registroForm.mes,
      año: registroForm.año,
      datos: registroForm.datos,
      control: controlValue, // Control automático
      total: total,
      date: new Date().toISOString()
    };

    try {
      // Si estamos editando, primero eliminar los registros existentes
      if (isEditing && existingRegistrosIds.length > 0) {
        const deletePromises = existingRegistrosIds.map(item => {
          if (typeof item === 'string') {
            // Es un ID de la colección registros
            return deleteDoc(doc(db, 'registros', item));
          } else {
            // Es un objeto con ID y nombre de colección
            return deleteDoc(doc(db, item.collection, item.id));
          }
        });
        
        await Promise.all(deletePromises);
      }
      
      // Guardar datos en Firebase (siempre como un nuevo documento)
      await addDoc(collection(db, 'registros'), newTransaction);
      
      // Guardar también en la colección correspondiente según el tipo (debe/haber)
      await Promise.all(registroForm.datos.map(async (dato) => {
        const collection_name = dato.tipoTransaccion === 'debe' ? 'debe' : 'haber';
        await addDoc(collection(db, collection_name), {
          empresa: registroForm.empresa,
          mes: registroForm.mes,
          año: registroForm.año,
          detalle: dato.detalle,
          control: controlValue, // Control automático
          tipo: dato.tipo,
          observacion: dato.observacion || "", // Incluir observación en la BD
          monto: parseFloat(dato.monto) || 0,
          date: new Date().toISOString()
        });
      }));
      
      // Limpiar solo los datos manteniendo empresa, mes y año
      setRegistroForm(prev => ({
        ...prev,
        datos: [{ 
          detalle: "", 
          tipo: "", 
          tipoTransaccion: "debe",
          monto: "",
          observacion: ""
        }],
        total: 0
      }));
      
      setErrors({});
      setTiposUsados(new Set()); // Reiniciar tipos usados
      setExistingRegistrosIds([]);
      setIsEditing(false);
      
      setNotification({
        show: true,
        message: isEditing ? "Registro actualizado exitosamente" : "Registro guardado exitosamente",
        type: "success"
      });
    } catch (error) {
      console.error("Error al guardar:", error);
      setNotification({
        show: true,
        message: "Error al guardar el registro: " + error.message,
        type: "error"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDatoChange = (index, field, value) => {
    const newDatos = [...registroForm.datos];
    
    // Si estamos cambiando el tipo, verificar si ya está en uso
    if (field === 'tipo' && value !== "Cuentas Varias" && value !== "" && tiposUsados.has(value)) {
      setNotification({
        show: true,
        message: `El tipo "${value}" ya ha sido seleccionado`,
        type: "error"
      });
      return;
    }
    
    newDatos[index] = {
      ...newDatos[index],
      [field]: value
    };

    const total = calculateTotal(newDatos);

    setRegistroForm(prev => ({
      ...prev,
      datos: newDatos,
      total: total
    }));

    if (errors[`${field}${index}`]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[`${field}${index}`];
        return newErrors;
      });
    }
    
    // Si estamos cambiando el detalle del primer dato, resetear estado de edición
    if (index === 0 && field === 'detalle') {
      setIsEditing(false);
      setExistingRegistrosIds([]);
    }
  };

  const handleTipoTransaccionChange = (index, tipo) => {
    const newDatos = [...registroForm.datos];
    newDatos[index] = {
      ...newDatos[index],
      tipoTransaccion: tipo
    };

    const total = calculateTotal(newDatos);

    setRegistroForm(prev => ({
      ...prev,
      datos: newDatos,
      total: total
    }));
  };

  const handleInputChange = (field, value) => {
    setRegistroForm(prev => ({
      ...prev,
      [field]: value
    }));

    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
    
    // Si cambiamos empresa, mes o año, resetear estado de edición
    if (field === 'empresa' || field === 'mes' || field === 'año') {
      setIsEditing(false);
      setExistingRegistrosIds([]);
    }
  };

  const addDatoRow = () => {
    setRegistroForm(prev => ({
      ...prev,
      datos: [
        ...prev.datos,
        { 
          detalle: prev.datos[0].detalle, // Copiar el detalle del primer dato
          tipo: "", 
          tipoTransaccion: "debe",
          monto: "",
          observacion: ""
        }
      ]
    }));
  };

  const removeDatoRow = (index) => {
    if (registroForm.datos.length > 1) {
      const newDatos = [...registroForm.datos];
      newDatos.splice(index, 1);
      
      const total = calculateTotal(newDatos);
      
      setRegistroForm(prev => ({
        ...prev,
        datos: newDatos,
        total: total
      }));
      
      // Remove any errors associated with this row
      const newErrors = {...errors};
      Object.keys(newErrors).forEach(key => {
        if (key.endsWith(index.toString())) {
          delete newErrors[key];
        }
      });
      setErrors(newErrors);
    }
  };

  // Filtrar tipos disponibles para cada fila según los ya utilizados
  const getTiposDisponibles = (currentTipo) => {
    // Combinar tipos base y personalizados
    const allTipos = [...tiposBase, ...customTipos];
    
    if (currentTipo && currentTipo !== "Cuentas Varias" && tiposUsados.has(currentTipo)) {
      // Si el tipo actual ya está seleccionado, permitir mantenerlo
      return allTipos;
    }
    
    return allTipos.filter(tipo => 
      tipo === "Cuentas Varias" || !tiposUsados.has(tipo) || tipo === currentTipo
    );
  };

  // Calcular los totales para mostrar
  const { totalDebe, totalHaber } = calculateTotals(registroForm.datos);

  return (
    <div className="container">
      {notification.show && (
        <div className={`notification ${notification.type}`}>
          {notification.message}
        </div>
      )}
      
      <div className="header">
        <h2>{isEditing ? 'Editar Registro' : 'Hacer Registro'}</h2>
        <div className="header-buttons">
          <button onClick={onBack} className="back-button">
            Atrás
          </button>
        </div>
      </div>

      {/* Empresa, Mes, Año section */}
      <div className="form-group">
        <label>Empresa Correspondiente:</label>
        <select
          value={registroForm.empresa}
          onChange={(e) => handleInputChange('empresa', e.target.value)}
          className={`select-empresa ${errors.empresa ? 'error' : ''}`}
        >
          <option value="">Seleccione una empresa</option>
          {empresas.map(empresa => (
            <option key={empresa.id} value={empresa.nombre}>
              {empresa.nombre} - {empresa.rut}
            </option>
          ))}
        </select>
        {errors.empresa && <span className="error-message">{errors.empresa}</span>}
      </div>

      <div className="form-row">
        <div className="form-group">
          <label>Mes Correspondiente:</label>
          <select
            value={registroForm.mes}
            onChange={(e) => handleInputChange('mes', e.target.value)}
            className={errors.mes ? 'error' : ''}
          >
            <option value="">Seleccione mes</option>
            {meses.map(mes => (
              <option key={mes} value={mes}>{mes}</option>
            ))}
          </select>
          {errors.mes && <span className="error-message">{errors.mes}</span>}
        </div>

        <div className="form-group">
          <label>Año:</label>
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            placeholder="YYYY"
            value={registroForm.año}
            onChange={(e) => handleInputChange('año', e.target.value)}
            maxLength="4"
            className={errors.año ? 'error' : ''}
          />
          {errors.año && <span className="error-message">{errors.año}</span>}
        </div>
      </div>

      {/* Campos de Detalle (solo para el primer dato) */}
      <div className="form-row">
        <div className="form-group">
          <label>Detalle:</label>
          <input
            type="text"
            placeholder="Detalle"
            value={registroForm.datos[0].detalle}
            onChange={(e) => handleDatoChange(0, 'detalle', e.target.value)}
            className={errors[`detalle0`] ? 'error' : ''}
          />
          {errors[`detalle0`] && <span className="error-message">{errors[`detalle0`]}</span>}
        </div>
      </div>

      {/* Nueva sección para crear tipo personalizado */}
      {registroForm.empresa && (
        <div className="create-new-tipo-section">
          {!showNewTipoInput ? (
            <button 
              onClick={() => setShowNewTipoInput(true)} 
              className="add-tipo-button"
              type="button"
            >
              Crear Nuevo Tipo
            </button>
          ) : (
            <div className="new-tipo-input-container">
              <input
                type="text"
                placeholder="Nombre del nuevo tipo"
                value={newTipoInput}
                onChange={(e) => setNewTipoInput(e.target.value)}
                className="new-tipo-input"
              />
              <div className="new-tipo-buttons">
                <button 
                  onClick={handleAddNewTipo} 
                  className="save-tipo-button"
                  type="button"
                >
                  Guardar
                </button>
                <button 
                  onClick={() => {
                    setShowNewTipoInput(false);
                    setNewTipoInput("");
                  }} 
                  className="cancel-tipo-button"
                  type="button"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {searchLoading && (
        <div className="search-indicator">
          <p>Buscando registros existentes...</p>
        </div>
      )}

      {isEditing && (
        <div className="edit-indicator">
          <p>Editando registro existente. Los cambios sobrescribirán el registro anterior.</p>
        </div>
      )}

      {/* Datos section */}
      <div className="datos-section">
        <h3>Datos ({registroForm.datos.length})</h3>
        
        {registroForm.datos.map((dato, index) => (
          <div key={index} className="dato-container">
            <div className="dato-row">
              <div className="form-group">
                <label>Tipo:</label>
                <select
                  value={dato.tipo}
                  onChange={(e) => handleDatoChange(index, 'tipo', e.target.value)}
                  className={errors[`tipo${index}`] ? 'error' : ''}
                >
                  <option value="">Seleccione tipo</option>
                  {getTiposDisponibles(dato.tipo).map(tipo => (
                    <option key={tipo} value={tipo}>{tipo}</option>
                  ))}
                </select>
                {errors[`tipo${index}`] && <span className="error-message">{errors[`tipo${index}`]}</span>}
              </div>
              
              <div className="transaction-type">
                <button
                  type="button"
                  className={`transaction-button ${dato.tipoTransaccion === 'debe' ? 'active' : ''}`}
                  onClick={() => handleTipoTransaccionChange(index, 'debe')}
                >
                  Debe
                </button>
                <button
                  type="button"
                  className={`transaction-button ${dato.tipoTransaccion === 'haber' ? 'active' : ''}`}
                  onClick={() => handleTipoTransaccionChange(index, 'haber')}
                >
                  Haber
                </button>
              </div>
              
              <div className="form-group">
                <label>Monto:</label>
                <input
                  type="text"
                  inputMode="decimal"
                  pattern="[0-9]*\.?[0-9]*"
                  placeholder="Monto"
                  value={dato.monto}
                  onChange={(e) => handleDatoChange(index, 'monto', e.target.value)}
                  className={errors[`monto${index}`] ? 'error' : ''}
                />
                {errors[`monto${index}`] && <span className="error-message">{errors[`monto${index}`]}</span>}
              </div>
              
              {registroForm.datos.length > 1 && (
                <button 
                  onClick={() => removeDatoRow(index)} 
                  className="remove-button"
                  title="Eliminar registro"
                  type="button"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Campo de observación para Cuentas Varias */}
            {dato.tipo === "Cuentas Varias" && (
              <div className="form-group observacion-field">
                <label>Observación:</label>
                <input
                  type="text"
                  placeholder="Describa la observación del monto"
                  value={dato.observacion || ""}
                  onChange={(e) => handleDatoChange(index, 'observacion', e.target.value)}
                  className={errors[`observacion${index}`] ? 'error' : ''}
                />
                {errors[`observacion${index}`] && <span className="error-message">{errors[`observacion${index}`]}</span>}
              </div>
            )}
            
            {index < registroForm.datos.length - 1 && <hr className="dato-divider" />}
          </div>
        ))}
        
        {/* Botón para agregar datos sin límite */}
        <button onClick={addDatoRow} className="add-button" type="button">
          Agregar Dato
        </button>
      </div>

      <div className="totals-container">
        <div className="total-item">
          Total DEBE: ${totalDebe.toFixed(2)}
        </div>
        <div className="total-item">
          Total HABER: ${totalHaber.toFixed(2)}
        </div>
        <div className="total">
          Diferencia: ${(totalDebe - totalHaber).toFixed(2)}
        </div>
        {errors.balance && <span className="error-message balance-error">{errors.balance}</span>}
      </div>

      <div className="button-group">
        <button 
          onClick={handleSubmit} 
          className="save-button"
          disabled={loading}
          type="button"
        >
          {loading ? 'Guardando...' : isEditing ? 'Actualizar Registro' : 'Guardar Registro'}
        </button>
        <button 
          onClick={onBack} 
          className="back-button"
          disabled={loading}
          type="button"
        >
          Volver al Menú Principal
        </button>
      </div>
    </div>
  );
};

export default Registro;