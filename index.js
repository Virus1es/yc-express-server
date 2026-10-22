import express from 'express';
import bodyParser from 'body-parser';
import { createReadStream } from 'node:fs';
import crypto from "node:crypto";
import http from "node:http";
import mongodb from "mongodb";
import pug from 'pug';
import { chromium } from 'playwright';

import appSrc from "./app.js";

const { MongoClient } = mongodb;

const app = appSrc(
    express,
    bodyParser,
    createReadStream,
    crypto,
    http,
    MongoClient,
    pug,
    chromium
);

app.listen(process.env.PORT || 3000);