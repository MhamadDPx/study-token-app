import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import './App.css';

// Replace with your deployed contract address
const CONTRACT_ADDRESS = "YOUR_CONTRACT_ADDRESS_HERE";

// Contract ABI (simplified - get full ABI from Remix)
const CONTRACT_ABI = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function balanceOf(address) view returns (uint256)",
  "function completedTasks(address) view returns (uint256)",
  "function completeTask(uint256) external",
  "function getUserStats(address) view returns (uint256, uint256, uint256)",
  "event TaskCompleted(address indexed user, uint256 taskId, uint256 reward)"
];

function App() {
  const [account, setAccount] = useState('');
  const [balance, setBalance] = useState('0');
  const [completedTasks, setCompletedTasks] = useState('0');
  const [contract, setContract] = useState(null);
  const [loading, setLoading] = useState(false);
  const [provider, setProvider] = useState(null);

  useEffect(() => {
    checkConnection();
    
    // Listen for account changes
    if (window.ethereum) {
      window.ethereum.on('accountsChanged', handleAccountsChanged);
      window.ethereum.on('chainChanged', () => window.location.reload());
    }
    
    return () => {
      if (window.ethereum) {
        window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
      }
    };
  }, []);

  const handleAccountsChanged = (accounts) => {
    if (accounts.length === 0) {
      setAccount('');
      setContract(null);
      setProvider(null);
    } else {
      connectWallet();
    }
  };

  const checkConnection = async () => {
    if (window.ethereum) {
      try {
        const accounts = await window.ethereum.request({ method: 'eth_accounts' });
        if (accounts.length > 0) {
          connectWallet();
        }
      } catch (error) {
        console.error('Error checking connection:', error);
      }
    }
  };

  const connectWallet = async () => {
    try {
      if (!window.ethereum) {
        alert('Please install MetaMask! Visit https://metamask.io/');
        return;
      }

      // Request account access
      const accounts = await window.ethereum.request({ 
        method: 'eth_requestAccounts' 
      });
      
      // Create provider and signer
      const web3Provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = web3Provider.getSigner();
      
      // Create contract instance
      const contractInstance = new ethers.Contract(
        CONTRACT_ADDRESS, 
        CONTRACT_ABI, 
        signer
      );

      setAccount(accounts[0]);
      setProvider(web3Provider);
      setContract(contractInstance);
      
      // Load user data
      await loadUserData(contractInstance, accounts[0]);
      
    } catch (error) {
      console.error('Error connecting wallet:', error);
      if (error.code === 4001) {
        alert('Please connect to MetaMask.');
      } else {
        alert('Error connecting to wallet. Please try again.');
      }
    }
  };

  const loadUserData = async (contractInstance, userAddress) => {
    try {
      // Get token balance
      const balance = await contractInstance.balanceOf(userAddress);
      // Get completed tasks count
      const tasks = await contractInstance.completedTasks(userAddress);
      
      setBalance(ethers.utils.formatEther(balance));
      setCompletedTasks(tasks.toString());
    } catch (error) {
      console.error('Error loading user data:', error);
    }
  };

  const completeTask = async () => {
    if (!contract) {
      alert('Please connect your wallet first!');
      return;
    }
    
    setLoading(true);
    try {
      const taskId = Date.now(); // Simple task ID based on timestamp
      
      // Estimate gas first
      const gasEstimate = await contract.estimateGas.completeTask(taskId);
      
      // Send transaction with some extra gas
      const tx = await contract.completeTask(taskId, {
        gasLimit: gasEstimate.mul(120).div(100) // Add 20% buffer
      });
      
      console.log('Transaction sent:', tx.hash);
      
      // Wait for confirmation
      const receipt = await tx.wait();
      console.log('Transaction confirmed:', receipt);
      
      alert('🎉 Task completed! You earned 10 STK tokens!');
      
      // Reload user data
      await loadUserData(contract, account);
      
    } catch (error) {
      console.error('Error completing task:', error);
      
      if (error.code === 4001) {
        alert('Transaction cancelled by user.');
      } else if (error.message.includes('Cooldown period active')) {
        alert('⏰ Cooldown period active! Please wait 1 hour between tasks.');
      } else if (error.message.includes('insufficient funds')) {
        alert('💰 Insufficient funds for gas fees. Please add some ETH/MATIC to your wallet.');
      } else {
        alert('❌ Error completing task. Please check console for details.');
      }
    }
    setLoading(false);
  };

  const disconnectWallet = () => {
    setAccount('');
    setContract(null);
    setProvider(null);
    setBalance('0');
    setCompletedTasks('0');
  };

  const addTokenToMetaMask = async () => {
    try {
      await window.ethereum.request({
        method: 'wallet_watchAsset',
        params: {
          type: 'ERC20',
          options: {
            address: CONTRACT_ADDRESS,
            symbol: 'STK',
            decimals: 18,
            image: '', // You can add a token logo URL here
          },
        },
      });
    } catch (error) {
      console.error('Error adding token to MetaMask:', error);
    }
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>🎓 StudyToken Platform</h1>
        <p>Learn, Complete Tasks, Earn Rewards!</p>
        
        {!account ? (
          <div className="connect-section">
            <p>Connect your wallet to start earning StudyTokens</p>
            <button onClick={connectWallet} className="connect-btn">
              Connect MetaMask Wallet
            </button>
            <p className="install-note">
              Don't have MetaMask? <a href="https://metamask.io/" target="_blank" rel="noopener noreferrer">Install it here</a>
            </p>
          </div>
        ) : (
          <div className="dashboard">
            <div className="user-info">
              <h2>Your Dashboard</h2>
              <p><strong>📍 Address:</strong> {account.slice(0, 6)}...{account.slice(-4)}</p>
              <p><strong>💰 STK Balance:</strong> {balance} STK</p>
              <p><strong>✅ Tasks Completed:</strong> {completedTasks}</p>
              
              <div className="wallet-actions">
                <button onClick={addTokenToMetaMask} className="secondary-btn">
                  Add STK to MetaMask
                </button>
                <button onClick={disconnectWallet} className="disconnect-btn">
                  Disconnect
                </button>
              </div>
            </div>
            
            <div className="actions">
              <h3>Complete a Study Task</h3>
              <p>Click the button below to simulate completing a study task and earn 10 STK tokens!</p>
              <button 
                onClick={completeTask} 
                disabled={loading}
                className="task-btn"
              >
                {loading ? '⏳ Processing...' : '📚 Complete Study Task (+10 STK)'}
              </button>
              <p className="cooldown-note">⏰ Note: 1 hour cooldown between tasks</p>
            </div>
            
            <div className="info-section">
              <h3>How StudyToken Works:</h3>
              <ul>
                <li>🎯 Complete study tasks to earn StudyToken (STK) rewards</li>
                <li>🏆 Each task completion rewards you with 10 STK tokens</li>
                <li>⏱️ Cooldown period: 1 hour between task completions</li>
                <li>💡 Use tokens for educational benefits or trade with peers</li>
                <li>🔒 Maximum supply: 1 million STK tokens</li>
              </ul>
            </div>
          </div>
        )}
      </header>
    </div>
  );
}

export default App;