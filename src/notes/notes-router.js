const path = require("path");
const express = require("express");
const xss = require("xss");
const logger = require("../logger");
const NotesService = require("./notes-service");

const notesRouter = express.Router();
const bodyParser = express.json();

const serializeNote = (note) => ({
  id: note.id,
  title: note.title,
  content: note.content,
  folder_id: note.folder_id,
  date_published: note.date_published,
});

notesRouter
  .route("/")
  .get((req, res, next) => {
    const knexInstance = req.app.get("db");
    NotesService.getAllNotes(knexInstance)
      .then((notes) => {
        res.json(notes.map(serializeNote));
      })
      .catch(next);
  })
  .post(bodyParser, (req, res, next) => {
    const { content, title, folder_id, date_created } = req.body;
    const newNote = { content, title, folder_id };

    for (const [key, value] of Object.entries(newNote))
      if (value == null)
        return res.status(400).json({
          error: { message: `Missing '${key}' in request body` },
        });

    NotesService.insertNote(req.app.get("db"), newNote)
      .then((note) => {
        res
          .status(201)
          .location(path.posix.join(req.originalUrl, `/${note.id}`))
          .json(serializeNote(note));
      })
      .catch(next);
  });

notesRouter
  .route("/:noteid")
  .all((req, res, next) => {
    NotesService.getById(req.app.get("db"), req.params.noteid)
      .then((note) => {
        if (!note) {
          return res.status(404).json({
            error: { message: `Note doesn't exist` },
          });
        }
        res.note = note;
        next();
      })
      .catch(next);
  })
  .get((req, res, next) => {
    res.json(serializeNote(res.note));
  })
  .delete((req, res, next) => {
    NotesService.deleteNote(req.app.get("db"), req.params.noteid)
      .then((numRowsAffected) => {
        res.status(204).end();
      })
      .catch(next);
  })
  .patch(bodyParser, (req, res, next) => {
    const { id, content, title } = req.body;

    const noteToUpdate = { id, content, title };
    // console.log(noteToUpdate);

    const numberOfValues = Object.values(noteToUpdate).filter(Boolean).length;
    if (numberOfValues === 0) {
      logger.error(`Invalid update without required fields`);
      return res.status(400).json({
        error: {
          message: `Request body must contain either 'content' or 'title'`,
        },
      });
    }

    NotesService.updateNote(req.app.get("db"), req.params.noteid, noteToUpdate)
      .then((numRowsAffected) => {
        res.status(204).end();
      })
      .catch(next);
  });

module.exports = notesRouter;
