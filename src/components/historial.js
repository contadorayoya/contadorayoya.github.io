import React, { useState, useEffect } from 'react';
import { db } from './firebaseConfig';
import './historial.css';
import { collection, query, where, onSnapshot, getDocs } from 'firebase/firestore';

function Historial({ onBack }) {
  const [transactions, setTransactions] = useState([]);
  const [selectedEmpresa, setSelectedEmpresa] = useState('');
  const [empresasList, setEmpresasList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fetchingEmpresas, setFetchingEmpresas] = useState(true);
  const [error, setError] = useState(null);
  const [selectedYear, setSelectedYear] = useState('');
  const [availableYears, setAvailableYears] = useState([]);

  const meses = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
  ];

  const tipos = [
    "Caja", "Ingreso", "Costo", "IVA", "PPM", 
    "Ajuste CF", "Retencion SC", "Honorarios", 
    "Gastos Generales"
    // "Cuentas Varias" - Eliminado como solicitado
  ];

  const unsubscribeRef = React.useRef(null);
  const tableRef = React.useRef(null);

  // Cargar la lista de empresas disponibles al montar el componente
  useEffect(() => {
    const fetchEmpresas = async () => {
      try {
        setFetchingEmpresas(true);
        setError(null);
        
        // Paso 1: Obtener empresas válidas desde la colección 'empresas'
        const validEmpresas = new Set();
        const empresasCol = collection(db, 'empresas');
        const empresasSnapshot = await getDocs(empresasCol);
        
        if (!empresasSnapshot.empty) {
          console.log(`Se encontraron ${empresasSnapshot.size} documentos en la colección empresas`);
          
          empresasSnapshot.forEach(doc => {
            const data = doc.data();
            if (data.nombre) {
              validEmpresas.add(data.nombre);
            }
          });
          
          console.log(`Empresas válidas en la colección empresas: ${Array.from(validEmpresas).join(', ')}`);
        } else {
          console.log("No hay documentos en la colección empresas");
        }
        
        // Paso 2: Obtener años desde la colección 'registros'
        const empresasFromRegistros = [];
        const years = [];
        
        const registrosCol = collection(db, 'registros');
        const registrosSnapshot = await getDocs(registrosCol);
        
        if (!registrosSnapshot.empty) {
          console.log(`Se encontraron ${registrosSnapshot.size} documentos en registros`);
          
          registrosSnapshot.forEach(doc => {
            const data = doc.data();
            
            if (data.empresa) {
              // Solo agregamos a la lista si la empresa existe en la colección 'empresas'
              if (validEmpresas.has(data.empresa)) {
                empresasFromRegistros.push(data.empresa);
              }
            }
            
            if (data.año) {
              const yearStr = data.año.toString();
              years.push(yearStr);
            }
          });
        } else {
          console.log("No hay documentos en la colección registros");
        }
        
        if (empresasFromRegistros.length === 0 && years.length === 0) {
          setError("No se encontraron registros en la base de datos");
          setFetchingEmpresas(false);
          return;
        }
        
        console.log(`Total empresas válidas extraídas: ${empresasFromRegistros.length}`);
        console.log(`Total años extraídos: ${years.length}`);
        
        // Eliminar duplicados y valores nulos
        const uniqueEmpresas = [...new Set(empresasFromRegistros)].filter(Boolean);
        const uniqueYears = [...new Set(years)].filter(Boolean);
        
        console.log(`Empresas únicas: ${uniqueEmpresas.join(', ')}`);
        console.log(`Años únicos: ${uniqueYears.join(', ')}`);
        
        // Ordenar alfabéticamente las empresas
        uniqueEmpresas.sort();
        
        // Ordenar años en orden descendente (más reciente primero)
        uniqueYears.sort((a, b) => b - a);
        
        setEmpresasList(uniqueEmpresas);
        setAvailableYears(uniqueYears);
        
        // Ahora NO seleccionamos la primera empresa por defecto
        // Solo seleccionamos el año más reciente por defecto
        if (uniqueYears.length > 0) {
          setSelectedYear(uniqueYears[0]);
          console.log(`Año seleccionado por defecto: ${uniqueYears[0]}`);
        }
      } catch (error) {
        console.error("Error al cargar la lista de empresas y años:", error);
        setError(`Error al cargar los datos: ${error.message}`);
      } finally {
        setFetchingEmpresas(false);
      }
    };

    fetchEmpresas();

    // Cleanup subscription on unmount
    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
    };
  }, []);

  // Ejecutar búsqueda automáticamente cuando se selecciona una empresa y un año
  useEffect(() => {
    if (selectedEmpresa && selectedYear && !fetchingEmpresas) {
      handleSearch();
    }
  }, [selectedEmpresa, selectedYear]);

  const handleSearch = () => {
    if (!selectedEmpresa) {
      setError("Por favor seleccione una empresa");
      return;
    }
    if (!selectedYear) {
      setError("Por favor seleccione un año");
      return;
    }

    setError(null);
    setLoading(true);
    
    // Limpiar transacciones anteriores
    setTransactions([]);

    // Cleanup previous subscription
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
    }

    console.log(`Buscando registros para empresa: "${selectedEmpresa}", año: "${selectedYear}"`);

    // Consultar la colección 'registros'
    const registrosQuery = query(
      collection(db, 'registros'),
      where('empresa', '==', selectedEmpresa),
      where('año', '==', selectedYear)
    );

    const unsubscribeRegistros = onSnapshot(registrosQuery, (snapshot) => {
      const registrosData = snapshot.docs.map(doc => {
        const data = doc.data();
        return { id: doc.id, ...data };
      });
      
      console.log(`Encontrados ${registrosData.length} registros en 'registros'`);
      
      if (registrosData.length === 0) {
        console.log("No se encontraron resultados para la búsqueda");
        setTransactions([]);
        setLoading(false);
        return;
      }
      
      setTransactions(registrosData);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching registros:", error);
      setError(`Error al cargar los datos: ${error.message}`);
      setLoading(false);
    });
    
    unsubscribeRef.current = unsubscribeRegistros;
  };

  const formatCurrency = (value) => {
    if (!value && value !== 0) return '-';
    
    // Si es string, convertir a número
    const numValue = typeof value === 'string' ? parseFloat(value) : value;
    
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0,
    }).format(numValue);
  };

  // Obtener todos los tipos personalizados en las transacciones
  const getAllCustomTypes = () => {
    const customTypes = new Set();
    
    transactions.forEach(transaction => {
      if (transaction.datos && transaction.datos.length > 0) {
        transaction.datos.forEach(item => {
          if (item.tipo && !tipos.includes(item.tipo)) {
            customTypes.add(item.tipo);
          }
        });
      }
    });
    
    return Array.from(customTypes).sort();
  };

  // Función para procesar las transacciones del mes
  const getMonthTransactions = (mes) => {
    if (!transactions.length) {
      return [];
    }
    
    console.log(`Obteniendo transacciones para el mes: ${mes}`);
    
    // Filtrar transacciones del mes
    const monthTransactions = transactions.filter(t => t.mes === mes);
    
    console.log(`Encontradas ${monthTransactions.length} transacciones para ${mes}`);
    
    // Agrupar transacciones por detalle
    const groupedByDetail = {};
    
    monthTransactions.forEach(transaction => {
      // Crear una clave única basada en detalle
      const detalle = transaction.datos && transaction.datos.length > 0 
        ? transaction.datos[0]?.detalle || 'Sin detalle' 
        : 'Sin detalle';
      
      if (!groupedByDetail[detalle]) {
        groupedByDetail[detalle] = {
          control: transaction.control,
          detalle: detalle,
          fecha: transaction.date,
          debe: {},
          haber: {}
        };
      }
      
      // Procesar todos los datos y mantenerlos en la misma entrada
      if (transaction.datos && transaction.datos.length > 0) {
        transaction.datos.forEach(item => {
          if (item.tipoTransaccion === 'debe') {
            groupedByDetail[detalle].debe[item.tipo] = parseFloat(item.monto);
          } else if (item.tipoTransaccion === 'haber') {
            groupedByDetail[detalle].haber[item.tipo] = parseFloat(item.monto);
          }
        });
      }
    });
    
    // Convertir el objeto agrupado a un array
    const result = Object.values(groupedByDetail);
    
    // Ordenar por fecha (si está disponible)
    result.sort((a, b) => {
      if (a.fecha && b.fecha) {
        if (a.fecha < b.fecha) return -1;
        if (a.fecha > b.fecha) return 1;
      }
      return 0;
    });
    
    return result;
  };

  // Función para renderizar filas de un mes específico
  const renderMonthRows = (mes) => {
    const monthTransactions = getMonthTransactions(mes);
    const customTypes = getAllCustomTypes();
    
    // Determinar el número de filas necesarias
    const numRows = Math.max(6, monthTransactions.length); // Mínimo 6 filas por mes
    
    // Preparar array para las filas
    const rowsToRender = Array(numRows).fill(null);
    
    // Llenar con transacciones existentes
    monthTransactions.forEach((transaction, index) => {
      rowsToRender[index] = transaction;
    });
    
    return (
      <React.Fragment key={mes}>
        {rowsToRender.map((rowData, index) => (
          <tr key={`${mes}-row-${index}`} className={index === rowsToRender.length - 1 ? "last-month-row" : ""}>
            {index === 0 && (
              <td className="mes-cell" rowSpan={rowsToRender.length}>
                <div className="vertical-text">{mes}</div>
              </td>
            )}
            <td className="detalle-cell">
              {rowData ? rowData.detalle || '-' : '-'}
            </td>
            <td className="control-cell">
              {rowData ? formatCurrency(rowData.control) : '-'}
            </td>
            {tipos.map(tipo => {
              // Para tipos normales
              let debeValue = '';
              let haberValue = '';
                
              if (rowData) {
                if (rowData.debe && rowData.debe[tipo] !== undefined) {
                  debeValue = rowData.debe[tipo];
                }
                  
                if (rowData.haber && rowData.haber[tipo] !== undefined) {
                  haberValue = rowData.haber[tipo];
                }
              }
                
              return (
                <React.Fragment key={`${mes}-${index}-${tipo}`}>
                  <td className="monto-cell debe">
                    {debeValue !== '' ? formatCurrency(debeValue) : '-'}
                  </td>
                  <td className="monto-cell haber">
                    {haberValue !== '' ? formatCurrency(haberValue) : '-'}
                  </td>
                </React.Fragment>
              );
            })}
            
            {/* Columnas para tipos personalizados */}
            {customTypes.map(tipo => {
              let debeValue = '';
              let haberValue = '';
              
              if (rowData) {
                if (rowData.debe && rowData.debe[tipo] !== undefined) {
                  debeValue = rowData.debe[tipo];
                }
                
                if (rowData.haber && rowData.haber[tipo] !== undefined) {
                  haberValue = rowData.haber[tipo];
                }
              }
              
              return (
                <React.Fragment key={`${mes}-${index}-tipo-${tipo}`}>
                  <td className="monto-cell debe">
                    {debeValue !== '' ? formatCurrency(debeValue) : '-'}
                  </td>
                  <td className="monto-cell haber">
                    {haberValue !== '' ? formatCurrency(haberValue) : '-'}
                  </td>
                </React.Fragment>
              );
            })}
          </tr>
        ))}
      </React.Fragment>
    );
  };

  return (
    <div className="historial-container">
      <div className="header-container">
        <button onClick={onBack} className="back-button">
          Volver al Formulario
        </button>
        
        <h1 className="title">Historial de Registros</h1>
        
        <div className="controls">
          <div className="control-group">
            <label htmlFor="empresa" className="label">Empresa:</label>
            <select
              id="empresa"
              value={selectedEmpresa}
              onChange={(e) => setSelectedEmpresa(e.target.value)}
              disabled={fetchingEmpresas || loading}
              className="select"
            >
              <option value="">Seleccionar Empresa</option>
              {empresasList.map((empresa) => (
                <option key={empresa} value={empresa}>
                  {empresa}
                </option>
              ))}
            </select>
          </div>
          
          <div className="control-group">
            <label htmlFor="year" className="label">Año:</label>
            <select
              id="year"
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              disabled={fetchingEmpresas || loading}
              className="select"
            >
              <option value="">Seleccionar Año</option>
              {availableYears.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>
          
          <div className="button-group">
            <button
              onClick={handleSearch}
              disabled={!selectedEmpresa || !selectedYear || loading || fetchingEmpresas}
              className="search-button"
            >
              {loading ? "Cargando..." : "Buscar"}
            </button>
          </div>
        </div>
      </div>
      
      {error && <div className="error-message">{error}</div>}
      
      {loading ? (
        <div className="loading">Cargando datos...</div>
      ) : (
        <div className="results-container">
          {transactions.length > 0 ? (
            <div className="table-wrapper">
              <table className="historial-table" ref={tableRef}>
                <thead>
                  <tr>
                    <th className="fixed-column mes-header" rowSpan="2">Mes</th>
                    <th className="fixed-column detalle-header" rowSpan="2">Detalle</th>
                    <th className="fixed-column control-header" rowSpan="2">Control</th>
                    
                    {tipos.map(tipo => (
                      <th className="tipo-header" key={`header-${tipo}`} colSpan="2">
                        {tipo}
                      </th>
                    ))}
                    
                    {/* Encabezados para tipos personalizados */}
                    {getAllCustomTypes().map(tipo => (
                      <th className="tipo-header" key={`header-custom-${tipo}`} colSpan="2">
                        {tipo}
                      </th>
                    ))}
                  </tr>
                  <tr>
                    {/* Subencabezados para tipos regulares */}
                    {tipos.map(tipo => (
                      <React.Fragment key={`subheader-${tipo}`}>
                        <th className="debe-header">Debe</th>
                        <th className="haber-header">Haber</th>
                      </React.Fragment>
                    ))}
                    
                    {/* Subencabezados para tipos personalizados */}
                    {getAllCustomTypes().map(tipo => (
                      <React.Fragment key={`subheader-custom-${tipo}`}>
                        <th className="debe-header">Debe</th>
                        <th className="haber-header">Haber</th>
                      </React.Fragment>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {meses.map(mes => renderMonthRows(mes))}
                </tbody>
              </table>
            </div>
          ) : (
            selectedEmpresa && selectedYear && !loading ? (
              <div className="no-results">No se encontraron registros para los criterios seleccionados.</div>
            ) : null
          )}
        </div>
      )}
    </div>
  );
}

export default Historial;