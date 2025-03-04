import React, { useState, useEffect } from 'react';
import { db } from './firebaseConfig';
import './empresas.css';
import { collection, addDoc, onSnapshot, deleteDoc, doc, updateDoc } from 'firebase/firestore';

function Empresas({ onBack }) {
  const [nombre, setNombre] = useState('');
  const [rut, setRut] = useState('');
  const [rutFormateado, setRutFormateado] = useState('');
  const [empresas, setEmpresas] = useState([]);

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

  // Función para formatear el RUT
  const formatearRut = (rutInput) => {
    // Eliminar todos los caracteres no alfanuméricos
    let rutLimpio = rutInput.replace(/[^0-9kK]/g, '');
    
    // Separar dígito verificador
    let dv = rutLimpio.slice(-1);
    let rutNumeros = rutLimpio.slice(0, -1);
    
    // Formatear con puntos y guion
    let rutFormateado = '';
    
    // Agregar puntos de miles
    for (let i = rutNumeros.length; i > 0; i -= 3) {
      const inicio = Math.max(0, i - 3);
      rutFormateado = (i === rutNumeros.length ? '' : '.') + 
                       rutNumeros.substring(inicio, i) + 
                       rutFormateado;
    }
    
    // Agregar dígito verificador
    rutFormateado = rutFormateado + '-' + dv;
    
    return rutFormateado;
  };

  // Actualizar el estado del RUT formateado cuando cambie el RUT
  useEffect(() => {
    if (rut) {
      // Solo formatear si hay al menos 2 caracteres (para evitar formatear mientras escribe)
      if (rut.length >= 2) {
        setRutFormateado(formatearRut(rut));
      } else {
        setRutFormateado('');
      }
    } else {
      setRutFormateado('');
    }
  }, [rut]);

  const handleAddEmpresa = async (e) => {
    e.preventDefault();
    if (nombre && rut) {
      try {
        // Usar el RUT formateado al guardar en Firestore
        const rutFinal = rutFormateado || formatearRut(rut);
        
        await addDoc(collection(db, 'empresas'), {
          nombre: nombre,
          rut: rutFinal
        });
        setNombre('');
        setRut('');
        setRutFormateado('');
      } catch (error) {
        console.error('Error al agregar la empresa:', error);
      }
    } else {
      alert('Por favor, complete ambos campos.');
    }
  };

  const handleDeleteEmpresa = async (id) => {
    if (window.confirm('¿Está seguro de que desea eliminar esta empresa?')) {
      try {
        await deleteDoc(doc(db, 'empresas', id));
      } catch (error) {
        console.error('Error al eliminar la empresa:', error);
      }
    }
  };

  const handleEditEmpresa = async (id) => {
    const empresa = empresas.find(e => e.id === id);
    if (!empresa) return;
    
    const newNombre = prompt('Nuevo nombre de la empresa:', empresa.nombre);
    // Mostrar el RUT sin formato para editar
    const rutSinFormato = empresa.rut.replace(/\./g, '').replace('-', '');
    const newRut = prompt('Nuevo RUT de la empresa:', rutSinFormato);
    
    if (newNombre && newRut) {
      try {
        // Formatear el nuevo RUT antes de guardar
        const newRutFormateado = formatearRut(newRut);
        
        await updateDoc(doc(db, 'empresas', id), {
          nombre: newNombre,
          rut: newRutFormateado
        });
      } catch (error) {
        console.error('Error al editar la empresa:', error);
      }
    } else if (newNombre !== null && newRut !== null) {
      // Solo mostrar alerta si el usuario no canceló la operación
      alert('Por favor, ingrese un nuevo nombre y RUT.');
    }
  };

  return (
    <div className="container">
      <h2>Gestión de Empresas</h2>
      
      <button onClick={onBack} className="back-bttn">
        Volver al Menú Principal
      </button>

      <form onSubmit={handleAddEmpresa}>
        <div className="form-group">
          <label htmlFor="nombre">Nombre de la Empresa</label>
          <input
            id="nombre"
            type="text"
            placeholder="Nombre de la empresa"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
          />
        </div>
        <div className="form-group">
          <label htmlFor="rut">RUT de la Empresa</label>
          <input
            id="rut"
            type="text"
            placeholder="RUT de la empresa (ej: 12345678-9)"
            value={rut}
            onChange={(e) => setRut(e.target.value)}
          />
          {rutFormateado && (
            <div className="rut-preview">
              <small>Vista previa: {rutFormateado}</small>
            </div>
          )}
        </div>
        <button type="submit" className="add-button">Agregar Empresa</button>
      </form>

      <h3>Lista de Empresas</h3>
      {empresas.length === 0 ? (
        <p className="no-data">No hay empresas registradas</p>
      ) : (
        <ul className="empresas-list">
          {empresas.map((empresa) => (
            <li key={empresa.id} className="empresa-item">
              <span><strong>{empresa.nombre}</strong> - {empresa.rut}</span>
              <div className="button-group">
                <button className="edit-button" onClick={() => handleEditEmpresa(empresa.id)}>Editar</button>
                <button className="delete-button" onClick={() => handleDeleteEmpresa(empresa.id)}>Eliminar</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default Empresas;