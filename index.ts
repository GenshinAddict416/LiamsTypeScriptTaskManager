import express from 'express';
import cors from 'cors';
import * as fs from 'fs/promises';
import * as path from 'path';

export enum Importance { LOW = "LOW", MID = "MID", HI = "HI" }
export enum Completion { NotStarted = "Not Started", InProgress = "In Progress", Completed = "Completed" }

interface Task {
  id: number;
  title: string;
  importance: Importance;
  completion: Completion;
}

class FileStorage<T extends { id: number }> {
  private filePath: string;
  constructor(fileName: string) {
    this.filePath = path.join(process.cwd(), fileName);
  }
  async save(data: T[]): Promise<void> {
    await fs.writeFile(this.filePath, JSON.stringify(data, null, 2), 'utf-8');
  }
  async load(): Promise<T[]> {
    try {
      const content = await fs.readFile(this.filePath, 'utf-8');
      return JSON.parse(content) as T[];
    } catch {
      return [];
    }
  }
}

const app = express();
app.use(cors());
app.use(express.json());

// ROUTE: Serve the static UI HTML file
app.use(express.static(process.cwd())); 

const storage = new FileStorage<Task>('tasks.json');

// ROUTE: Get all tasks
app.get('/api/tasks', async (_req, res) => {
  const tasks = await storage.load();
  res.json(tasks);
});

// ROUTE: Add a task
app.post('/api/tasks', async (req, res) => {
  try {
    const tasks = await storage.load();
    const { title, importance, completion } = req.body;

    if (!title || !importance || !completion) {
      return res.status(400).json({ error: "Missing task properties" });
    }

    const nextId = tasks.length > 0 ? Math.max(...tasks.map(t => t.id)) + 1 : 1;
    const newTask: Task = { id: nextId, title, importance, completion };
    
    tasks.push(newTask);
    await storage.save(tasks);
    res.status(201).json(newTask);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ROUTE: Delete a task
app.delete('/api/tasks/:id', async (req, res) => {
  try {
    const tasks = await storage.load();
    const idToDelete = parseInt(req.params.id, 10);
    const index = tasks.findIndex(t => t.id === idToDelete);

    if (index === -1) {
      return res.status(404).json({ error: "Task not found" });
    }

    tasks.splice(index, 1);
    await storage.save(tasks);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/tasks/:id/progress', async (req, res) => {
  try {
    const tasks = await storage.load();
    const idToUpdate = parseInt(req.params.id, 10);
    const task = tasks.find(t => t.id === idToUpdate);

    if (!task) {
      return res.status(404).json({ error: "Task not found" });
    }

    // Logic to cycle statuses: Not Started -> In Progress -> Completed -> Not Started
    if (task.completion === Completion.NotStarted) {
      task.completion = Completion.InProgress;
    } else if (task.completion === Completion.InProgress) {
      task.completion = Completion.Completed;
    } else {
      task.completion = Completion.NotStarted;
    }

    await storage.save(tasks);
    res.json(task);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ROUTE: Shutdown the server
app.post('/api/shutdown', (_req, res) => {
  res.json({ success: true, message: "Server shutting down..." });
  console.log("Shutdown requested. Closing server...");
  
  // Delay exit slightly to allow the response to reach the browser
  setTimeout(() => {
    process.exit(0);
  }, 500);
});


app.listen(3000, () => console.log('Backend running at http://localhost:3000'));