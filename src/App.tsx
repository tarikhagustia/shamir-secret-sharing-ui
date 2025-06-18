import React, { useState, useCallback } from 'react'
import './App.css'
import { Buffer } from 'buffer'

// @ts-expect-error - shamirs-secret-sharing doesn't have TypeScript definitions
import * as sss from 'shamirs-secret-sharing'

// Make Buffer available globally for the library
window.Buffer = Buffer

interface Share {
  id: number
  data: Buffer
}

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'split' | 'combine'>('split')
  const [secret, setSecret] = useState('')
  const [totalShares, setTotalShares] = useState(5)
  const [threshold, setThreshold] = useState(3)
  const [shares, setShares] = useState<Share[]>([])
  const [uploadedShards, setUploadedShards] = useState<File[]>([])
  const [recoveredSecret, setRecoveredSecret] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [isRecovering, setIsRecovering] = useState(false)

  const generateShares = useCallback(async () => {
    if (!secret.trim()) {
      alert('Please enter a secret to share')
      return
    }

    if (threshold > totalShares) {
      alert('Threshold cannot be greater than total shares')
      return
    }

    setIsGenerating(true)
    try {
      const secretBuffer = Buffer.from(secret, 'utf8')
      const generatedShares = sss.split(secretBuffer, {
        shares: totalShares,
        threshold: threshold
      })

      const shareObjects: Share[] = generatedShares.map((share: Buffer, index: number) => ({
        id: index + 1,
        data: share
      }))

      setShares(shareObjects)
    } catch (error) {
      console.error('Error generating shares:', error)
      alert('Error generating shares. Please try again.')
    } finally {
      setIsGenerating(false)
    }
  }, [secret, totalShares, threshold])

  const downloadShard = useCallback((share: Share) => {
    const blob = new Blob([new Uint8Array(share.data)], { type: 'application/octet-stream' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `secret-shard-${share.id}.shard`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, [])

  const downloadAllShards = useCallback(() => {
    shares.forEach(share => downloadShard(share))
  }, [shares, downloadShard])

  const handleShardUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || [])
    setUploadedShards(files)
  }, [])

  const recoverSecret = useCallback(async () => {
    if (uploadedShards.length < 2) {
      alert('Please upload at least 2 shard files')
      return
    }

    setIsRecovering(true)
    try {
      const shardBuffers = await Promise.all(
        uploadedShards.map(file => 
          new Promise<Buffer>((resolve) => {
            const reader = new FileReader()
            reader.onload = (e) => {
              const arrayBuffer = e.target?.result as ArrayBuffer
              resolve(Buffer.from(arrayBuffer))
            }
            reader.readAsArrayBuffer(file)
          })
        )
      )

      const recovered = sss.combine(shardBuffers)
      setRecoveredSecret(recovered.toString('utf8'))
    } catch (error) {
      console.error('Error recovering secret:', error)
      alert('Error recovering secret. Please ensure you have valid shard files.')
    } finally {
      setIsRecovering(false)
    }
  }, [uploadedShards])

  const clearAll = useCallback(() => {
    setSecret('')
    setShares([])
    setUploadedShards([])
    setRecoveredSecret('')
  }, [])

  return (
    <div className="app">
      <div className="container">
        <header className="header">
          <h1 className="title">🔐 Shamir's Secret Sharing</h1>
          <p className="subtitle">Securely split and recover your secrets</p>
        </header>

        <div className="tabs">
          <button 
            className={`tab ${activeTab === 'split' ? 'active' : ''}`}
            onClick={() => setActiveTab('split')}
          >
            Split Secret
          </button>
          <button 
            className={`tab ${activeTab === 'combine' ? 'active' : ''}`}
            onClick={() => setActiveTab('combine')}
          >
            Recover Secret
          </button>
        </div>

        {activeTab === 'split' && (
          <div className="tab-content">
            <div className="form-group">
              <label htmlFor="secret">Secret to Share</label>
              <textarea
                id="secret"
                value={secret}
                onChange={(e) => setSecret(e.target.value)}
                placeholder="Enter your secret here..."
                rows={4}
                className="input textarea"
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="totalShares">Total Shares</label>
                <input
                  id="totalShares"
                  type="number"
                  min="2"
                  max="255"
                  value={totalShares}
                  onChange={(e) => setTotalShares(parseInt(e.target.value))}
                  className="input"
                />
              </div>
              <div className="form-group">
                <label htmlFor="threshold">Threshold</label>
                <input
                  id="threshold"
                  type="number"
                  min="2"
                  max={totalShares}
                  value={threshold}
                  onChange={(e) => setThreshold(parseInt(e.target.value))}
                  className="input"
                />
              </div>
            </div>

            <div className="info-box">
              <p>ℹ️ This will create <strong>{totalShares}</strong> shares, requiring <strong>{threshold}</strong> shares to recover the secret.</p>
            </div>

            <button 
              onClick={generateShares}
              disabled={isGenerating || !secret.trim()}
              className="btn btn-primary"
            >
              {isGenerating ? 'Generating...' : 'Generate Shares'}
            </button>

            {shares.length > 0 && (
              <div className="shares-section">
                <div className="shares-header">
                  <h3>Generated Shares</h3>
                  <button onClick={downloadAllShards} className="btn btn-secondary">
                    Download All Shards
                  </button>
                </div>
                <div className="shares-grid">
                  {shares.map(share => (
                    <div key={share.id} className="share-card">
                      <div className="share-header">
                        <span className="share-id">Shard #{share.id}</span>
                        <button 
                          onClick={() => downloadShard(share)}
                          className="btn btn-small"
                        >
                          Download
                        </button>
                      </div>
                      <div className="share-preview">
                        {share.data.toString('hex').substring(0, 32)}...
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'combine' && (
          <div className="tab-content">
            <div className="form-group">
              <label htmlFor="shards">Upload Shard Files</label>
              <input
                id="shards"
                type="file"
                multiple
                accept=".shard"
                onChange={handleShardUpload}
                className="input file-input"
              />
            </div>

            {uploadedShards.length > 0 && (
              <div className="uploaded-shards">
                <h4>Uploaded Shards ({uploadedShards.length})</h4>
                <div className="shard-list">
                  {uploadedShards.map((file, index) => (
                    <div key={index} className="shard-item">
                      📄 {file.name}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <button 
              onClick={recoverSecret}
              disabled={isRecovering || uploadedShards.length < 2}
              className="btn btn-primary"
            >
              {isRecovering ? 'Recovering...' : 'Recover Secret'}
            </button>

            {recoveredSecret && (
              <div className="recovered-section">
                <h3>Recovered Secret</h3>
                <div className="recovered-secret">
                  {recoveredSecret}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="actions">
          <button onClick={clearAll} className="btn btn-outline">
            Clear All
          </button>
        </div>
      </div>
    </div>
  )
}

export default App
