import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);
Config.setConcurrency(null);
Config.setOffthreadVideoCacheSizeInBytes(8 * 1024 * 1024 * 1024);
Config.setCodec("h264");
