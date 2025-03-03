import React, { useState, useEffect } from 'react';
import { db } from './firebaseConfig';
import { collection, query, where, getDocs, doc, setDoc, getDoc } from 'firebase/firestore';
import './balance.css';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver'

const BalanceContable = ({ onBack }) => {
  const [empresas, setEmpresas] = useState([]);
  const [selectedEmpresa, setSelectedEmpresa] = useState('');
  const [selectedAño, setSelectedAño] = useState('');
  const [balanceData, setBalanceData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);


// Add this function to your BalanceContable component
const exportToExcel = async () => {
  if (!selectedEmpresa || !selectedAño || balanceData.length === 0) {
    setError("No hay datos para exportar");
    return;
  }

  // Get empresa data
  const selectedEmpresaData = empresas.find(e => e.nombre === selectedEmpresa);
  const rut = selectedEmpresaData?.rut || '';
  const direccion = selectedEmpresaData?.direccion || '';
  const giro = selectedEmpresaData?.giro || '';
  const comuna = selectedEmpresaData?.comuna || '';

  // Create workbook and worksheet
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Balance General');
  
  // Format title
  worksheet.mergeCells('A1:L1');
  const titleCell = worksheet.getCell('A1');
  titleCell.value = 'BALANCE GENERAL';
  titleCell.font = { bold: true, size: 16 };
  titleCell.alignment = { horizontal: 'center' };
  
  // Skip a row (row 2 empty)
  
  // Company info rows
  worksheet.getCell('A3').value = `Nombre o razón social: ${selectedEmpresa}`;
  worksheet.getCell('A3').font = { bold: true };
  worksheet.getCell('I3').value = `RUT: ${rut}`;
  worksheet.getCell('I3').font = { bold: true };
  
  worksheet.getCell('A4').value = `DIRECCIÓN: ${direccion}`;
  worksheet.getCell('A4').font = { bold: true };
  worksheet.getCell('I4').value = `COMUNA: ${comuna}`;
  worksheet.getCell('I4').font = { bold: true };
  
  worksheet.getCell('A5').value = `GIRO: ${giro}`;
  worksheet.getCell('A5').font = { bold: true };
  
  worksheet.getCell('A6').value = `EJERCICIO COMPRENDIDO ENTRE EL 01 DE ENERO DE ${selectedAño} AL 31 DE DICIEMBRE DE ${selectedAño}`;
  worksheet.getCell('A6').font = { bold: true };
  worksheet.mergeCells('A6:L6');
  
  // Table headers - row 7
  const headerRow = worksheet.addRow([
    'Nombre de Cuentas', 
    'Débito', 
    'Crédito', 
    'Deudor', 
    'Acreedor', 
    'Activo', 
    'Pasivo', 
    'Pérdidas', 
    'Ganancias'
  ]);
  
  // Style header
  headerRow.eachCell((cell) => {
    cell.font = { bold: true };
    cell.alignment = { horizontal: 'center' };
    cell.border = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' }
    };
  });
  
  // Format columns
  worksheet.columns = [
    { key: 'tipo', width: 30 },
    { key: 'debe', width: 15 },
    { key: 'haber', width: 15 },
    { key: 'saldoDeudor', width: 15 },
    { key: 'saldoAcreedor', width: 15 },
    { key: 'activoInventario', width: 15 },
    { key: 'pasivoInventario', width: 15 },
    { key: 'perdidas', width: 15 },
    { key: 'ganancias', width: 15 }
  ];
  
  // Add data rows
  balanceData.forEach((item) => {
    if (!item.isBlank) {
      const row = worksheet.addRow([
        item.tipo,
        item.debe > 0 ? item.debe : '',
        item.haber > 0 ? item.haber : '',
        item.saldoDeudor > 0 ? item.saldoDeudor : '',
        item.saldoAcreedor > 0 ? item.saldoAcreedor : '',
        item.activoInventario > 0 ? item.activoInventario : '',
        item.pasivoInventario > 0 ? item.pasivoInventario : '',
        item.perdidas > 0 ? item.perdidas : '',
        item.ganancias > 0 ? item.ganancias : ''
      ]);
      
      // Apply number format
      row.getCell(2).numFmt = '#,##0.00';
      row.getCell(3).numFmt = '#,##0.00';
      row.getCell(4).numFmt = '#,##0.00';
      row.getCell(5).numFmt = '#,##0.00';
      row.getCell(6).numFmt = '#,##0.00';
      row.getCell(7).numFmt = '#,##0.00';
      row.getCell(8).numFmt = '#,##0.00';
      row.getCell(9).numFmt = '#,##0.00';
      
      // Apply styles to special rows
      if (item.isSumas || item.isUtilidad || item.isTotal) {
        row.eachCell((cell) => {
          cell.font = { bold: true };
        });
      }
      
      // Apply cell borders
      row.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        };
      });
    } else {
      // Add empty row for spacing
      worksheet.addRow([]);
    }
  });
  
  // Add empty row after table
  worksheet.addRow([]);
  
  // Add signature lines
  const lastRow = worksheet.lastRow.number + 1;
  
  // Signature line for Contador
  worksheet.getCell(`A${lastRow}`).value = '_______________________';
  worksheet.getCell(`A${lastRow + 1}`).value = 'CONTADOR';
  worksheet.getCell(`A${lastRow + 1}`).font = { bold: true };
  worksheet.getCell(`A${lastRow + 1}`).alignment = { horizontal: 'center' };
  worksheet.mergeCells(`A${lastRow}:C${lastRow}`);
  worksheet.getCell(`A${lastRow}`).alignment = { horizontal: 'center' };
  worksheet.mergeCells(`A${lastRow + 1}:C${lastRow + 1}`);
  
  // Signature line for Representante Legal
  worksheet.getCell(`F${lastRow}`).value = '_______________________';
  worksheet.getCell(`F${lastRow + 1}`).value = 'REPRESENTANTE LEGAL';
  worksheet.getCell(`F${lastRow + 1}`).font = { bold: true };
  worksheet.getCell(`F${lastRow + 1}`).alignment = { horizontal: 'center' };
  worksheet.mergeCells(`F${lastRow}:I${lastRow}`);
  worksheet.getCell(`F${lastRow}`).alignment = { horizontal: 'center' };
  worksheet.mergeCells(`F${lastRow + 1}:I${lastRow + 1}`);
  
  // Generate the Excel file
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  saveAs(blob, `Balance_${selectedEmpresa}_${selectedAño}.xlsx`);
};






  // Cargar empresas desde Firebase
  useEffect(() => {
    const fetchEmpresas = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, 'empresas'));
        const empresasList = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setEmpresas(empresasList);
      } catch (err) {
        setError("Error al cargar empresas: " + err.message);
      }
    };

    fetchEmpresas();
  }, []);

  // Buscar datos cuando se selecciona empresa y año
  const fetchBalanceData = async () => {
    if (!selectedEmpresa || !selectedAño) {
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      // Obtener los registros de "debe" para todo el año
      const debeQuery = query(
        collection(db, 'debe'),
        where('empresa', '==', selectedEmpresa),
        where('año', '==', selectedAño)
      );
      
      // Obtener los registros de "haber" para todo el año
      const haberQuery = query(
        collection(db, 'haber'),
        where('empresa', '==', selectedEmpresa),
        where('año', '==', selectedAño)
      );
      
      const [debeSnapshot, haberSnapshot] = await Promise.all([
        getDocs(debeQuery),
        getDocs(haberQuery)
      ]);
      
      // Obtener los tipos de la empresa seleccionada
      const selectedEmpresaData = empresas.find(e => e.nombre === selectedEmpresa);
      const tiposBase = [
        "Caja", "Ingreso", "Costo", "IVA", "PPM", "Ajuste CF", 
        "Retencion SC", "Honorarios", "Gastos Generales", "Cuentas Varias"
      ];
      
      const tiposPersonalizados = selectedEmpresaData?.tipos_personalizados || [];
      const allTipos = [...tiposBase, ...tiposPersonalizados];
      
      // Preparar el objeto para almacenar los totales por tipo
      const totalesPorTipo = {};
      
      // Inicializar todos los tipos con valores en cero
      allTipos.forEach(tipo => {
        totalesPorTipo[tipo] = { 
          debe: 0, 
          haber: 0,
          activoInventario: 0,
          pasivoInventario: 0,
          perdidas: 0,
          ganancias: 0
        };
      });
      
      // Procesar datos de "debe"
      debeSnapshot.forEach(doc => {
        const data = doc.data();
        if (totalesPorTipo[data.tipo]) {
          totalesPorTipo[data.tipo].debe += parseFloat(data.monto) || 0;
        }
      });
      
      // Procesar datos de "haber"
      haberSnapshot.forEach(doc => {
        const data = doc.data();
        if (totalesPorTipo[data.tipo]) {
          totalesPorTipo[data.tipo].haber += parseFloat(data.monto) || 0;
        }
      });
      
      // Convertir a array para renderizar y calcular saldos
      const balanceArray = Object.entries(totalesPorTipo).map(([tipo, valores]) => {
        const saldo = valores.debe - valores.haber;
        return {
          tipo,
          debe: valores.debe,
          haber: valores.haber,
          saldoDeudor: saldo > 0 ? saldo : 0,
          saldoAcreedor: saldo < 0 ? Math.abs(saldo) : 0,
          activoInventario: 0,  // Inicializamos en 0, se asignará según categoría
          pasivoInventario: 0,  // Inicializamos en 0, se asignará según categoría
          perdidas: 0,          // Inicializamos en 0, se asignará según categoría
          ganancias: 0,         // Inicializamos en 0, se asignará según categoría
          // Guardamos una referencia al saldo para usar en categorización
          saldo: saldo
        };
      });
      
      // ID del documento (combina empresa y año)
      const docId = `${selectedEmpresa}_${selectedAño}`;
      
      // Tratamos de cargar configuraciones guardadas anteriormente
      try {
        const balanceConfigRef = doc(db, 'balances', docId);
        const balanceConfigSnapshot = await getDoc(balanceConfigRef);
        
        if (balanceConfigSnapshot.exists()) {
          const savedConfig = balanceConfigSnapshot.data();
          
          // Aplicar configuraciones guardadas
          if (savedConfig.categorias && Array.isArray(savedConfig.categorias)) {
            savedConfig.categorias.forEach(cat => {
              const index = balanceArray.findIndex(item => item.tipo === cat.tipo);
              if (index !== -1) {
                // Obtener el valor correcto del saldo (deudor o acreedor)
                const valor = balanceArray[index].saldoDeudor > 0 
                  ? balanceArray[index].saldoDeudor 
                  : balanceArray[index].saldoAcreedor;
                
                // Aplicar categoría guardada
                if (cat.categoria === 'activo') {
                  balanceArray[index].activoInventario = valor;
                } else if (cat.categoria === 'pasivo') {
                  balanceArray[index].pasivoInventario = valor;
                } else if (cat.categoria === 'perdidas') {
                  balanceArray[index].perdidas = valor;
                } else if (cat.categoria === 'ganancias') {
                  balanceArray[index].ganancias = valor;
                }
              }
            });
          }
        }
      } catch (err) {
        // Si no hay configuraciones guardadas, continuamos con la configuración por defecto
        console.log("No hay configuraciones guardadas, usando valores predeterminados");
      }
      
      // Calcular totales generales
      const totalDebe = balanceArray.reduce((sum, item) => sum + item.debe, 0);
      const totalHaber = balanceArray.reduce((sum, item) => sum + item.haber, 0);
      const totalSaldoDeudor = balanceArray.reduce((sum, item) => sum + item.saldoDeudor, 0);
      const totalSaldoAcreedor = balanceArray.reduce((sum, item) => sum + item.saldoAcreedor, 0);
      const totalActivoInventario = balanceArray.reduce((sum, item) => sum + item.activoInventario, 0);
      const totalPasivoInventario = balanceArray.reduce((sum, item) => sum + item.pasivoInventario, 0);
      const totalPerdidas = balanceArray.reduce((sum, item) => sum + item.perdidas, 0);
      const totalGanancias = balanceArray.reduce((sum, item) => sum + item.ganancias, 0);
      
      // Calcular la utilidad del ejercicio
      const diferencia = totalGanancias - totalPerdidas;
      
      // Fila en blanco (separador)
      const filaVacia = {
        tipo: '',
        debe: 0,
        haber: 0,
        saldoDeudor: 0,
        saldoAcreedor: 0,
        activoInventario: 0,
        pasivoInventario: 0,
        perdidas: 0,
        ganancias: 0,
        isBlank: true
      };
      
      // Fila de sumas
      const filaSumas = {
        tipo: 'SUMAS',
        debe: totalDebe,
        haber: totalHaber,
        saldoDeudor: totalSaldoDeudor,
        saldoAcreedor: totalSaldoAcreedor,
        activoInventario: totalActivoInventario,
        pasivoInventario: totalPasivoInventario,
        perdidas: totalPerdidas,
        ganancias: totalGanancias,
        isSumas: true
      };
      
      // Fila de utilidad del ejercicio
      const filaUtilidad = {
        tipo: 'UTILIDAD DEL EJERCICIO',
        debe: 0,
        haber: 0,
        saldoDeudor: 0,
        saldoAcreedor: 0,
        activoInventario: diferencia < 0 ? Math.abs(diferencia) : 0, // Si hay pérdida, va en activo
        pasivoInventario: diferencia > 0 ? diferencia : 0, // Si hay ganancia, va en pasivo
        perdidas: diferencia > 0 ? diferencia : 0, // Si hay ganancia, se muestra en pérdidas
        ganancias: diferencia < 0 ? Math.abs(diferencia) : 0, // Si hay pérdida, se muestra en ganancias
        isUtilidad: true
      };
      
      // Fila de totales finales
      const filaTotales = {
        tipo: 'TOTALES',
        debe: totalDebe,
        haber: totalHaber,
        saldoDeudor: totalSaldoDeudor,
        saldoAcreedor: totalSaldoAcreedor,
        activoInventario: totalActivoInventario + (diferencia < 0 ? Math.abs(diferencia) : 0), // Sumamos si hay pérdida
        pasivoInventario: totalPasivoInventario + (diferencia > 0 ? diferencia : 0), // Sumamos si hay ganancia
        perdidas: totalPerdidas + (diferencia > 0 ? diferencia : 0), // Sumamos si hay ganancia
        ganancias: totalGanancias + (diferencia < 0 ? Math.abs(diferencia) : 0), // Sumamos si hay pérdida
        isTotal: true
      };
      
      // Agregar las filas adicionales
      balanceArray.push(filaVacia);
      balanceArray.push(filaSumas);
      balanceArray.push(filaUtilidad);
      balanceArray.push(filaTotales);
      
      setBalanceData(balanceArray);
    } catch (err) {
      setError("Error al cargar datos: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Ejecutar búsqueda cuando cambian los filtros
  useEffect(() => {
    if (selectedEmpresa && selectedAño) {
      fetchBalanceData();
    }
  }, [selectedEmpresa, selectedAño]);

  // Manejar asignación a categoría
  const handleCategoryAssign = (index, category) => {
    // No hacer nada para las filas especiales
    if (balanceData[index].isBlank || balanceData[index].isSumas || 
        balanceData[index].isUtilidad || balanceData[index].isTotal) {
      return;
    }

    // Hacer una copia profunda del array de datos para poder modificarlo
    const newBalanceData = JSON.parse(JSON.stringify(balanceData));
    
    // CORRECCIÓN: Obtener el valor correcto del saldo (deudor o acreedor)
    const valor = newBalanceData[index].saldoDeudor > 0 
      ? newBalanceData[index].saldoDeudor 
      : newBalanceData[index].saldoAcreedor;
    
    // Resetear los valores anteriores en todas las categorías para esta fila
    newBalanceData[index].activoInventario = 0;
    newBalanceData[index].pasivoInventario = 0;
    newBalanceData[index].perdidas = 0;
    newBalanceData[index].ganancias = 0;
    
    // Asignar el valor a la categoría seleccionada
    switch (category) {
      case 'activo':
        newBalanceData[index].activoInventario = valor;
        break;
      case 'pasivo':
        newBalanceData[index].pasivoInventario = valor;
        break;
      case 'perdidas':
        newBalanceData[index].perdidas = valor;
        break;
      case 'ganancias':
        newBalanceData[index].ganancias = valor;
        break;
      default:
        break;
    }
    
    // Recalcular los totales
    const normalRows = newBalanceData.filter(item => 
      !item.isBlank && !item.isSumas && !item.isUtilidad && !item.isTotal);
    
    const totalActivoInventario = normalRows.reduce((sum, item) => sum + item.activoInventario, 0);
    const totalPasivoInventario = normalRows.reduce((sum, item) => sum + item.pasivoInventario, 0);
    const totalPerdidas = normalRows.reduce((sum, item) => sum + item.perdidas, 0);
    const totalGanancias = normalRows.reduce((sum, item) => sum + item.ganancias, 0);
    
    // Actualizar los valores de las filas de sumas y totales
    const sumasIndex = newBalanceData.findIndex(item => item.isSumas);
    if (sumasIndex !== -1) {
      newBalanceData[sumasIndex].activoInventario = totalActivoInventario;
      newBalanceData[sumasIndex].pasivoInventario = totalPasivoInventario;
      newBalanceData[sumasIndex].perdidas = totalPerdidas;
      newBalanceData[sumasIndex].ganancias = totalGanancias;
    }
    
    // Calcular la diferencia entre ganancias y pérdidas
    const diferencia = totalGanancias - totalPerdidas;
    
    // Actualizar la fila de utilidad
    const utilidadIndex = newBalanceData.findIndex(item => item.isUtilidad);
    if (utilidadIndex !== -1) {
      newBalanceData[utilidadIndex].saldoDeudor = 0;
      newBalanceData[utilidadIndex].saldoAcreedor = 0;
      newBalanceData[utilidadIndex].activoInventario = diferencia < 0 ? Math.abs(diferencia) : 0;
      newBalanceData[utilidadIndex].pasivoInventario = diferencia > 0 ? diferencia : 0;
      newBalanceData[utilidadIndex].perdidas = diferencia > 0 ? diferencia : 0;
      newBalanceData[utilidadIndex].ganancias = diferencia < 0 ? Math.abs(diferencia) : 0;
    }
    
    // Actualizar la fila de totales
    const totalesIndex = newBalanceData.findIndex(item => item.isTotal);
    if (totalesIndex !== -1) {
      newBalanceData[totalesIndex].activoInventario = totalActivoInventario + (diferencia < 0 ? Math.abs(diferencia) : 0);
      newBalanceData[totalesIndex].pasivoInventario = totalPasivoInventario + (diferencia > 0 ? diferencia : 0);
      newBalanceData[totalesIndex].perdidas = totalPerdidas + (diferencia > 0 ? diferencia : 0);
      newBalanceData[totalesIndex].ganancias = totalGanancias + (diferencia < 0 ? Math.abs(diferencia) : 0);
    }
    
    // Actualizar el estado
    setBalanceData(newBalanceData);
  };

  // FUNCIÓN ACTUALIZADA: Guardar configuración en Firebase
  const handleSaveConfiguration = async () => {
    if (!selectedEmpresa || !selectedAño || balanceData.length === 0) {
      setError("No hay datos para guardar");
      return;
    }

    setSaving(true);
    setSaveSuccess(false);
    setError(null);

    try {
      // Obtener solo las filas normales (no especiales)
      const normalRows = balanceData.filter(item => 
        !item.isBlank && !item.isSumas && !item.isUtilidad && !item.isTotal);
      
      // Preparar datos para guardar
      const categoriasAsignadas = normalRows.map(item => {
        // Determinar la categoría asignada
        let categoria = null;
        if (item.activoInventario > 0) categoria = 'activo';
        else if (item.pasivoInventario > 0) categoria = 'pasivo';
        else if (item.perdidas > 0) categoria = 'perdidas';
        else if (item.ganancias > 0) categoria = 'ganancias';
        
        return {
          tipo: item.tipo,
          categoria: categoria
        };
      }).filter(item => item.categoria !== null); // Solo guardar los que tienen categoría asignada
      
      // ID del documento (combina empresa y año)
      const docId = `${selectedEmpresa}_${selectedAño}`;
      
      // Referencia al documento en la colección balances
      const balanceConfigRef = doc(db, 'balances', docId);
      
      // Verificar si el documento ya existe
      const docSnap = await getDoc(balanceConfigRef);
      
      // Datos a guardar
      const dataToSave = {
        empresa: selectedEmpresa,
        año: selectedAño,
        categorias: categoriasAsignadas,
        ultimaActualizacion: new Date().toISOString()
      };
      
      // Guardar o actualizar en Firestore
      await setDoc(balanceConfigRef, dataToSave, { merge: true });
      
      setSaveSuccess(true);
      
      // Ocultar el mensaje de éxito después de 3 segundos
      setTimeout(() => {
        setSaveSuccess(false);
      }, 3000);
    } catch (err) {
      setError("Error al guardar configuración: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="balance-container">
      <h2 className="balance-title">Balance Contable Anual</h2>
      
      {/* Botones de acciones */}
      <div className="balance-control-panel">
        <div className="balance-action-buttons">
          <button 
            className="balance-return-btn"
            onClick={onBack}
          >
            Volver al Menú Principal
          </button>
          
          {/* BOTÓN: Guardar Configuración */}
          <button 
            className="balance-save-btn"
            disabled={!balanceData.length || loading || saving}
            onClick={handleSaveConfiguration}
          >
            {saving ? 'Guardando...' : 'Guardar'}
          </button>
          
          <button 
  className="balance-excel-btn"
  disabled={!balanceData.length || loading}
  onClick={exportToExcel}
>
  Exportar a Excel
</button>
          
          <button 
            className="balance-pdf-btn"
            disabled={!balanceData.length || loading}
            onClick={() => { /* Lógica para exportar a PDF */ }}
          >
            Exportar a PDF
          </button>
        </div>
        
        {/* Mensaje de éxito */}
        {saveSuccess && (
          <div className="balance-save-success-message">
            Configuración guardada correctamente
          </div>
        )}
        
        {/* Filtros */}
        <div className="balance-filters-container">
          <div className="balance-filter-group">
            <label>Empresa:</label>
            <select 
              className="balance-empresa-select" 
              value={selectedEmpresa} 
              onChange={(e) => setSelectedEmpresa(e.target.value)}
            >
              <option value="">Seleccione una empresa</option>
              {empresas.map(empresa => (
                <option key={empresa.id} value={empresa.nombre}>
                  {empresa.nombre}
                </option>
              ))}
            </select>
          </div>
          
          <div className="balance-filter-group">
            <label>Año:</label>
            <input 
              type="text" 
              className="balance-year-input" 
              placeholder="YYYY" 
              value={selectedAño} 
              onChange={(e) => setSelectedAño(e.target.value)} 
              maxLength="4" 
            />
          </div>
          
          <div className="balance-filter-group">
            <label>&nbsp;</label>
            <button 
              className="balance-search-btn"
              onClick={fetchBalanceData}
            >
              Buscar
            </button>
          </div>
        </div>
      </div>
      
      {/* Tabla de resultados */}
      {loading ? (
        <div className="balance-loading">Cargando datos...</div>
      ) : error ? (
        <div className="balance-error-message">{error}</div>
      ) : balanceData.length > 0 ? (
        <div className="balance-table-wrapper">
          <div className="balance-header-info">
            <h3>Balance de {selectedEmpresa} - Año {selectedAño}</h3>
          </div>
          
          <div className="balance-table-container">
            <table className="balance-data-table">
              <thead>
                <tr>
                  <th colSpan="4" className="balance-category-header">Categorizar</th>
                  <th rowSpan="2" className="balance-account-name-header">Nombre de Cuentas</th>
                  <th colSpan="2" className="text-center">Sumas</th>
                  <th colSpan="2" className="text-center">Saldos</th>
                  <th colSpan="2" className="text-center">Inventario</th>
                  <th colSpan="2" className="text-center">Resultado</th>
                </tr>
                <tr>
                  <th className="balance-category-btn-header">Act</th>
                  <th className="balance-category-btn-header">Pas</th>
                  <th className="balance-category-btn-header">Per</th>
                  <th className="balance-category-btn-header">Gan</th>
                  <th className="balance-amount-header">Débito</th>
                  <th className="balance-amount-header">Crédito</th>
                  <th className="balance-amount-header">Deudor</th>
                  <th className="balance-amount-header">Acreedor</th>
                  <th className="balance-amount-header">Activo</th>
                  <th className="balance-amount-header">Pasivo</th>
                  <th className="balance-amount-header">Pérdidas</th>
                  <th className="balance-amount-header">Ganancias</th>
                </tr>
              </thead>
              <tbody>
                {balanceData.map((item, index) => (
                  <tr 
                    key={index} 
                    className={
                      item.isBlank ? "balance-blank-row" : 
                      item.isSumas ? "balance-sumas-row" :
                      item.isUtilidad ? "balance-utilidad-row" : 
                      item.isTotal ? "balance-total-row" : "balance-data-row"
                    }
                  >
                    {/* Botones de categorización */}
                    <td className="balance-category-cell">
                      {!item.isBlank && !item.isSumas && !item.isUtilidad && !item.isTotal && (
                        <button 
                          className="balance-category-btn balance-activo-btn"
                          onClick={() => handleCategoryAssign(index, 'activo')}
                          title="Asignar a Activo"
                        >
                          Act
                        </button>
                      )}
                    </td>
                    <td className="balance-category-cell">
                      {!item.isBlank && !item.isSumas && !item.isUtilidad && !item.isTotal && (
                        <button 
                          className="balance-category-btn balance-pasivo-btn"
                          onClick={() => handleCategoryAssign(index, 'pasivo')}
                          title="Asignar a Pasivo"
                        >
                          Pas
                        </button>
                      )}
                    </td>
                    <td className="balance-category-cell">
                      {!item.isBlank && !item.isSumas && !item.isUtilidad && !item.isTotal && (
                        <button 
                          className="balance-category-btn balance-perdidas-btn"
                          onClick={() => handleCategoryAssign(index, 'perdidas')}
                          title="Asignar a Pérdidas"
                        >
                          Per
                        </button>
                      )}
                    </td>
                    <td className="balance-category-cell">
                      {!item.isBlank && !item.isSumas && !item.isUtilidad && !item.isTotal && (
                        <button 
                          className="balance-category-btn balance-ganancias-btn"
                          onClick={() => handleCategoryAssign(index, 'ganancias')}
                          title="Asignar a Ganancias"
                        >
                          Gan
                        </button>
                      )}
                    </td>
                    
                    <td className={`balance-tipo-cell ${item.isBlank ? "balance-blank-cell" : ""}`}>{item.tipo}</td>
                    <td className="balance-monto-cell">
                      {!item.isBlank && item.debe > 0 ? item.debe.toLocaleString('es-CL', { 
                        minimumFractionDigits: 2, 
                        maximumFractionDigits: 2 
                      }) : ''}
                    </td>
                    <td className="balance-monto-cell">
                      {!item.isBlank && item.haber > 0 ? item.haber.toLocaleString('es-CL', { 
                        minimumFractionDigits: 2, 
                        maximumFractionDigits: 2 
                      }) : ''}
                    </td>
                    <td className="balance-monto-cell">
                      {!item.isBlank && item.saldoDeudor > 0 ? item.saldoDeudor.toLocaleString('es-CL', { 
                        minimumFractionDigits: 2, 
                        maximumFractionDigits: 2 
                      }) : ''}
                    </td>
                    <td className="balance-monto-cell">
                      {!item.isBlank && item.saldoAcreedor > 0 ? item.saldoAcreedor.toLocaleString('es-CL', { 
                        minimumFractionDigits: 2, 
                        maximumFractionDigits: 2 
                      }) : ''}
                    </td>
                    <td className="balance-monto-cell">
                      {!item.isBlank && item.activoInventario > 0 ? item.activoInventario.toLocaleString('es-CL', { 
                        minimumFractionDigits: 2, 
                        maximumFractionDigits: 2 
                      }) : ''}
                    </td>
                    <td className="balance-monto-cell">
                      {!item.isBlank && item.pasivoInventario > 0 ? item.pasivoInventario.toLocaleString('es-CL', { 
                        minimumFractionDigits: 2, 
                        maximumFractionDigits: 2 
                      }) : ''}
                    </td>
                    <td className="balance-monto-cell">
                      {!item.isBlank && item.perdidas > 0 ? item.perdidas.toLocaleString('es-CL', { 
                        minimumFractionDigits: 2, 
                        maximumFractionDigits: 2 
                      }) : ''}
                    </td>
                    <td className="balance-monto-cell">
                      {!item.isBlank && item.ganancias > 0 ? item.ganancias.toLocaleString('es-CL', { 
                        minimumFractionDigits: 2, 
                        maximumFractionDigits: 2 
                      }) : ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : selectedEmpresa && selectedAño ? (
        <div className="balance-no-data">No se encontraron datos para los filtros seleccionados</div>
      ) : (
        <div className="balance-no-data">Seleccione empresa y año para ver el balance</div>
      )}
    </div>
  );
};

export default BalanceContable;