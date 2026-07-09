import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSettings } from "@/stores/settings";

export function SettingsDialog({ trigger }: { trigger?: React.ReactElement }) {
  const { endpoint, apiKey, model, setSettings } = useSettings();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ endpoint, apiKey, model });

  function save() {
    setSettings(form);
    setOpen(false);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        // reset form to persisted values whenever the dialog opens
        if (next) setForm({ endpoint, apiKey, model });
        setOpen(next);
      }}
    >
      <DialogTrigger
        render={trigger ?? <Button variant="outline">设置</Button>}
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>AI 设置（BYOK）</DialogTitle>
          <DialogDescription className="leading-relaxed">
            填入你自己的 OpenAI 兼容 Endpoint 与 API
            Key。这些值只保存在你的浏览器本地，绝不上传。
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label htmlFor="endpoint">Endpoint</Label>
            <Input
              id="endpoint"
              placeholder="https://api.openai.com/v1"
              value={form.endpoint}
              onChange={(e) => setForm({ ...form, endpoint: e.target.value })}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="apiKey">API Key</Label>
            <Input
              id="apiKey"
              type="password"
              placeholder="sk-..."
              value={form.apiKey}
              onChange={(e) => setForm({ ...form, apiKey: e.target.value })}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="model">Model</Label>
            <Input
              id="model"
              placeholder="gpt-4o-mini"
              value={form.model}
              onChange={(e) => setForm({ ...form, model: e.target.value })}
            />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={save}>保存</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
