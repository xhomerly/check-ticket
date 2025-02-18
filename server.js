require('dotenv').config();

const express = require('express');
const mysql = require('mysql2');
const path = require('path')
const fs = require('fs');
const crypto = require('crypto');
const moment = require('moment');

const app = express();
const port = 3002;

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const db = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 100,
    queueLimit: 0
});

app.get('/ticket/:uuid', (req, res) => {
    const uuid = req.params.uuid;

    db.query('SELECT status, type, table_num, name, updated_at FROM tickets WHERE uuid LIKE ?',
        [uuid], (err, result) => {
        if (err) {
            console.error('Error getting status:', err);
            res.status(500).send('Database error');
            return;
        } else {
            if (result.length > 0) {
                const { status, type, table_num, name, updated_at } = result[0];   
                
                let typeInHTML;
                if (type == 'sezeni') {
                    typeInHTML = 'Sezení';
                } else typeInHTML = 'Stání';
                
                if (status === 'valid') {
                    fs.readFile(path.join(__dirname, 'public', 'ticket.html'), 'utf8', (err, html) => {
                        if (err) {
                            console.error('Error reading HTML file:', err);
                            res.status(500).send('Server error');
                            return;
                        }
    
                        html = html.replace('{{uuid}}', uuid)
                                .replace('{{uuid}}', uuid)
                                .replace('{{type}}', typeInHTML)
    
                        if (table_num) {
                            html = html.replace('{{table_num}}', `<p><strong>Číslo stolu:</strong> ${table_num}</p>`);
                        } else {
                            html = html.replace('{{table_num}}', '');
                        }
    
                        if (name) {
                            html = html.replace('{{name}}', `<p><strong>Na jméno:</strong> ${name}</p>`);
                        } else {
                            html = html.replace('{{name}}', '');
                        }
    
                        res.send(html);
                    });
                } else {
                    fs.readFile(path.join(__dirname, 'public', 'redeemed.html'), 'utf8', (err, html) => {
                        if (err) {
                            console.error('Error reading HTML file:', err);
                            res.status(500).send('Server error');
                            return;
                        }

                        const formattedTimeStamp = moment(updated_at).format('HH:mm:ss DD.MM.YYYY');
    
                        html = html.replace('{{uuid}}', uuid)
                                .replace('{{type}}', typeInHTML)
                                .replace('{{updated_at}}', formattedTimeStamp)
    
                        if (table_num) {
                            html = html.replace('{{table_num}}', `<p><strong>Číslo stolu:</strong> ${table_num}</p>`);
                        } else {
                            html = html.replace('{{table_num}}', '');
                        }
    
                        if (name) {
                            html = html.replace('{{name}}', `<p><strong>Na jméno:</strong> ${name}</p>`);
                        } else {
                            html = html.replace('{{name}}', '');
                        }
    
                        res.send(html);
                    });
                }

                    
            } else {
                fs.readFile(path.join(__dirname, 'public', 'error.html'), 'utf8', (err, html) => {
                    if (err) {
                        console.error('Error reading HTML file:', err);
                        res.status(500).send('Server error');
                        return;
                    }

                    html = html.replace('{{uuid}}', uuid);
                    res.send(html);
                });
            }
        }
    });
});

app.post('/redeem_ticket', (req, res) => {
    const { uuid } = req.body;

    db.query('UPDATE tickets SET status = "redeemed", updated_at = CURRENT_TIMESTAMP WHERE uuid = ?',
        [uuid], (err) => {
            if (err) {
                console.error('Error updating database:', err);
                return res.json({ success: false });
            }
            res.json({ success: true });
        }
    );
});

app.post('/create_ticket', (req, res) => {
    const uuid = crypto.randomUUID();
    const SECRET_KEY = process.env.SECRET_KEY
    const { type, table_num, name, secret_key } = req.body;

    if (secret_key == SECRET_KEY) {
        db.query('INSERT INTO tickets (uuid, type, table_num, name) VALUES (?, ?, ?, ?)',
        [uuid, type, table_num, name], (err) => {
            if (err) {
                console.error('Error creating ticket:', err);
                res.status(500).send('Database error');
                return;
            } else {
                res.send(`New ticket created with UUID: ${uuid}`);
            }
        });
    } else {
        res.send('Invalid password fool');
    }
});

app.listen(port, () => {
    console.log(`App for checking tickets is listening on port ${port}`);
});