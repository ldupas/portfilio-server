const connection = require("../db-config");
const router = require("express").Router();
const Joi = require('joi');
const argon2 = require('argon2');

const { findUserByEmail, insertUser } = require('../models/user');
const { generateJwt } = require('../utils/auth');
const checkJwt = require('../middlewares/checkJwt')

const userSchema = Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().required(),
})

router.get('/', checkJwt, (req, res) => {
    connection.query("SELECT * FROM user", (err, result) => {
        if(err) {
            res.status(500).send("Error retrieving users from database");
        } else {
            res.json(result);
        }
    })
});

router.get('/:id', (req, res) =>  {
    const userId = req.params.id;
    connection.query('SELECT * FROM user WHERE id=?', 
    [userId], 
    (err, results) => {
        if(err) {
            res.status(500).send("Error retrieving users from database");
        } else {
            if (results.length) res.json(results[0]);
            else res.status(404).send("User not found");
        }
    })
})

router.post('/', async (req, res) => {
    const { value, error } = userSchema.validate(req.body);
    
    if (error) {
        return res.status(400).json(error);
    }

    const [[existingUser]] = await findUserByEmail(value.email);
    if (existingUser) {
        return res.status(409).json({
            message: "L'utilisateur existe déjà.",
        })
    }

    const hashedPassword = await argon2.hash(value.password);
    await insertUser(value.email, hashedPassword);

    // const jwtKey = generateJwt(value.email);
    // return res.json({
    //     credentials: jwtKey,
    // })

    return res.json({
        message: "L'utilisateur a bien été créé"
    })
});

router.post('/login', async (req, res) => {
    const { value, error } = userSchema.validate(req.body);
    
    if (error) {
      return res.status(400).json(error);
    };
  
    const [[existingUser]] = await findUserByEmail(value.email);
  
    if (!existingUser) {
      return res.status(403).json({
        message: 'Utilisateur non trouvé ou le mdp ne correspond pas au compte.'
      })
    };
  
    const verified = await argon2.verify(existingUser.password, value.password)
  
    if (!verified) {
      return res.status(403).json({
        message: 'Utilisateur non trouvé ou le mdp ne correspond pas au compte.'
      })
    }
  
    const jwtKey = generateJwt(value.email);
    return res.json({
      credentials: jwtKey
    })
})

// Maintenant, j'aimerais pouvoir ajouter de la data dans ma DB
// sur ce thème précis évidemment
// router.post('/', (req, res) => {
//     // Ici je déscructure le corps de ma requête
//     // Corps de ma requête = propriétés de ma table DB
//     // (au moins, ce qui est en NOT NULL par défaut)
//     const { email, password } = req.body;
//     connection.query(
//     'INSERT INTO user (email, password) VALUES (?, ?)',
//     [email, password],
//     (err, result) => {
//         if (err) {
//             res.status(500).send('Error retrieving products from database');
//         }
//         else 
//         {
//             const id = result.insertId;
//             // Ici je définis ce que je veux voir en tant que retour json
//             const createdUser = { id, email, password };
//             res.status(201).json(createdUser);
//         }
//     }
// )
// });

// Maintenant, je veux pouvoir modifier des infos 
// concernant un produit 
router.put('/:id', (req, res) => {
    const userId = req.params.id;
    const db = connection.promise();
    let existingUser = null;

    db.query('SELECT * FROM user WHERE id = ?', 
    [userId])
    .then(([results]) => {
        existingUser = results[0];
        if (!existingUser) return Promise.reject('User not found')
        return db.query('UPDATE user SET ? WHERE id = ?', [req.body, userId]);
    })
    .then(() => {
        res.status(200).json({...existingUser, ...req.body});
    })
    .catch((err) => {
        console.log(err);
        if (err === 'User not found')
        res.status(404).send(`User with id ${userId} not found.`)
        else {
            res.status(500).send('Error updating user from database');
        }
    });
});

// Dernière étape d'un CRUD "basique", il faut pouvoir supprimer
// une ligne de la DB (tuple, sous entendu un objet)
router.delete('/:id', (req, res) => {
    const userId = req.params.id;
    connection.query(
        'DELETE FROM user WHERE id = ?',
        [userId],
        (err, result) => {
            if (err) {
                console.log(err);
                res.status(500).send('Error while deleting a user');
            }
            else
            {
                // On va chercher la ligne affectée en question
                // Si tout va, on renvoie donc un status 200 de suppression
                if(result.affectedRows) res.status(200).send('🎉 User deleted')
                else res.status(404).send('User not found!')
            }
        }
    )
});

module.exports = router;