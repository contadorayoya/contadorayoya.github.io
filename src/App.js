import React, { useState, useEffect } from 'react';
import './App.css';
import { db } from './components/firebaseConfig';
import { collection, addDoc, onSnapshot, query, orderBy } from 'firebase/firestore';
import Historial from './components/historial';
import Empresas from './components/Empresas'; 
import Registro from './components/registro';
import Balance from './components/balance';


function App() {
  const [view, setView] = useState("main");
  const [transactions, setTransactions] = useState([]);

  useEffect(() => {
    console.log('Iniciando fetch de transacciones en App.js...');
    
    const q = query(collection(db, 'transactions'), orderBy('date', 'desc'));
    console.log('Query creado');
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      console.log('Snapshot recibido:', snapshot.size, 'documentos');
      
      const fetchedTransactions = snapshot.docs.map(doc => {
        const data = doc.data();
        console.log('Documento:', doc.id, data);
        return { 
          id: doc.id, 
          ...data 
        };
      });
      
      console.log('Transacciones procesadas:', fetchedTransactions);
      setTransactions(fetchedTransactions);
    }, (error) => {
      console.error('Error en snapshot:', error);
    });

    return () => unsubscribe();
  }, []);

  const handleTransactionSubmit = async (newTransaction) => {
    try {
      console.log('Guardando nueva transacción:', newTransaction);
      await addDoc(collection(db, 'transactions'), newTransaction);
      setView("main");
    } catch (error) {
      console.error("Error al guardar la transacción: ", error);
    }
  };

  const handleBackToMain = () => {
    setView("main");
  };

  const renderMainView = () => (
    <div className="container">
      <h2>Menú Principal</h2>
      <div className="button-container" style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        <button className="registro-button" onClick={() => setView("Registro")}>Hacer Registro</button>
        <button className="empresas-button" onClick={() => setView("empresas")}>Empresas</button>
        <button className="history-button" onClick={() => setView("dates")}>Ver Historial</button>
        <button className="balance-button" onClick={() => setView("balance")}>Balance</button>
      </div>
    </div>
  );

  return (
    <div className="App">
      {view === "main" && renderMainView()}
      {view === "dates" && <Historial onBack={handleBackToMain} transactions={transactions} />}
      {view === "empresas" && <Empresas onBack={handleBackToMain} />}
      {view === "Registro" && <Registro onBack={handleBackToMain} />}
      {view === "balance" && <Balance onBack={handleBackToMain} />}

    </div>
  );
}  

export default App;