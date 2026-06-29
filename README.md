# Nodalab — Visual Neural Network Builder

A browser-based block programming environment for designing neural network architectures. Drag-and-drop layer blocks, connect them into computational graphs, configure parameters, write custom layers, and export clean PyTorch code.

## Features

- **Visual Graph Editor** — Drag-and-drop neural network blocks on a canvas powered by React Flow
- **18 Built-in Blocks** — Linear, Conv2d, LSTM, MultiHeadAttention, Embedding, LayerNorm, BatchNorm2d, ReLU, GELU, Softmax, Sigmoid, Dropout, Add, Concat, Reshape, Flatten, Input, Output
- **Custom Blocks** — Write your own `forward()` logic with the embedded Monaco code editor and save reusable custom blocks to the sidebar
- **Live Shape Propagation** — See tensor dimensions flowing through the graph in real-time
- **PyTorch Code Generation** — Exports clean, idiomatic `nn.Module` code
- **ONNX Export** — Download supported graphs as `model.onnx`
- **Parameter Counter** — Live parameter count as you build
- **Training Config** — Configure supervised training or PPO reinforcement learning and export a complete training script
- **Live Training Visualization** — Start synthetic supervised or Gymnasium PPO training and watch activation, gradient, and weight-update metrics on graph nodes
- **Pre-built Templates** — MLP, CNN, Transformer Encoder, Autoencoder, LSTM Classifier
- **Model Execution** — Run a dummy forward pass on the backend to verify the architecture
- **Share via URL** — Encode the graph in a URL and share with anyone
- **Save/Load** — LocalStorage persistence + JSON export/import
- **Keyboard Shortcuts** — Ctrl+Z undo, Ctrl+Shift+Z redo, Ctrl+D duplicate, Ctrl+S save, Delete remove

## Tech Stack

**Frontend:**
- React 19 + TypeScript
- React Flow (node graph canvas)
- Monaco Editor (custom block code editor)
- Tailwind CSS v4
- Zustand (state management)
- Vite (build tool)

**Backend:**
- Python 3.10+
- FastAPI
- PyTorch
- Pydantic
- Jinja2

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- Python 3.10+
- PyTorch (install from https://pytorch.org)

### Frontend

```bash
cd frontend
npm install
npm run dev
```

The frontend runs at `http://localhost:5173`.

### Backend

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

The API runs at `http://localhost:8000`. API docs at `http://localhost:8000/docs`.

The frontend proxies `/api/*` requests to the backend during development.

## Project Structure

```
Nodalab/
├── frontend/
│   └── src/
│       ├── blocks/           # Block type definitions and registry
│       │   └── definitions/  # Individual block schemas (layers, activations, etc.)
│       ├── components/       # React UI components
│       ├── engine/           # Graph logic, shape propagation, code generation
│       └── store/            # Zustand state stores
├── backend/
│   └── app/
│       ├── routers/          # FastAPI route handlers
│       ├── services/         # Business logic (shape propagation, validation, execution)
│       ├── schemas/          # Pydantic models
│       └── templates/        # Jinja2 code generation templates
└── README.md
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/shapes/propagate` | Propagate tensor shapes through the graph |
| POST | `/api/validate/custom-block` | Validate custom block Python code |
| POST | `/api/execute/run` | Run a dummy forward pass |
| POST | `/api/export/code` | Generate PyTorch code from graph |
| POST | `/api/export/onnx` | Export model as ONNX file |
| POST | `/api/train/start` | Start a live training telemetry job |
| GET | `/api/train/status/{job_id}` | Poll training telemetry |
| POST | `/api/train/stop/{job_id}` | Stop a running training job |
| GET | `/api/health` | Health check |
