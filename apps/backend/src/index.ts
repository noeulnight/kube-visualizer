import express from "express";
import type { Response } from "express";
import cors from "cors";
import { getCurrentState, k8sEvents, startInformers } from "./informer";
import { buildDelta } from "./graph";
import { Delta, ResourceData, ResourceType } from "./types";
import "dotenv/config";

const app = express();
const PORT = 3000;

app.use(cors());

const isEmptyDelta = (delta: Delta) =>
  delta.addedNodes.length === 0 &&
  delta.modifiedNodes.length === 0 &&
  delta.removedNodes.length === 0 &&
  delta.addedEdges.length === 0 &&
  delta.removedEdges.length === 0;

const sseClients = new Set<Response>();
let graphResources: ResourceData[] = [];
let pendingGraphFlush: NodeJS.Timeout | null = null;

const writeSseDelta = (client: Response, delta: Delta) => {
  if (!client.writableEnded) {
    client.write(`data: ${JSON.stringify(delta)}\n\n`);
  }
};

const flushGraphChanges = () => {
  pendingGraphFlush = null;
  const nextResources = getCurrentState();
  if (sseClients.size === 0) {
    graphResources = nextResources;
    return;
  }

  const delta = buildDelta(graphResources, nextResources);
  graphResources = nextResources;

  if (isEmptyDelta(delta)) {
    return;
  }

  sseClients.forEach((client) => writeSseDelta(client, delta));
};

const scheduleGraphFlush = () => {
  if (pendingGraphFlush) return;
  pendingGraphFlush = setTimeout(flushGraphChanges, 250);
};

k8sEvents.on("event", scheduleGraphFlush);

app.get("/events", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  console.log("Client connected");
  const hadClients = sseClients.size > 0;
  sseClients.add(res);

  const currentResources = getCurrentState();
  if (!hadClients) {
    graphResources = currentResources;
  }
  writeSseDelta(res, buildDelta([], currentResources));

  const heartbeatInterval = setInterval(() => {
    res.write(`: heartbeat\n\n`);
  }, 30000);

  req.on("close", () => {
    clearInterval(heartbeatInterval);
    sseClients.delete(res);
    console.log("Client disconnected");
  });
});

const maskSensitiveData = (resource: any) => {
  const masked = JSON.parse(JSON.stringify(resource)) as ResourceData;

  const SENSITIVE_ANNOTATIONS = [
    "kubectl.kubernetes.io/last-applied-configuration",
  ];

  if (masked.raw.metadata?.annotations) {
    SENSITIVE_ANNOTATIONS.forEach((key) => {
      delete masked.raw.metadata?.annotations?.[key];
    });
  }

  // Remove Configmap data
  if (masked.resourceType === ResourceType.ConfigMap && masked.raw.data) {
    masked.raw.data = Object.fromEntries(
      Object.entries(masked.raw.data).map(([key, value]) => {
        const byteSize = Buffer.byteLength(value, "utf-8");
        return [key, `${byteSize} bytes`];
      }),
    );
  }

  return masked;
};

// GET /api/resources - Return all resources with full details
app.get("/api/resources", (req, res) => {
  const resources = getCurrentState();
  const maskedResources = resources.map(maskSensitiveData);
  res.json(maskedResources);
});

// GET /api/resource/:id - Return single resource by id
// id format: "ResourceType:namespace/name" (e.g., "Pod:default/my-pod")
app.get("/api/resource/:id", (req, res) => {
  const { id } = req.params;
  const resources = getCurrentState();
  const resource = resources.find((r) => {
    const metadata = r.raw.metadata;
    const resourceId = `${r.resourceType}:${metadata?.namespace ?? ""}/${r.raw.metadata?.name}`;
    return resourceId === id;
  });

  if (resource) {
    res.json(maskSensitiveData(resource));
  } else {
    res.status(404).json({ error: "Resource not found" });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

startInformers();
