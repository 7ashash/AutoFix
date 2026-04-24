import { spawnSync } from "child_process";

spawnSync("taskkill", ["/IM", "mysqld.exe", "/F"], { stdio: "inherit", shell: true });
